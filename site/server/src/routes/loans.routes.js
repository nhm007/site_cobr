import { Router } from 'express';
import dayjs from 'dayjs';
import { db } from '../db.js';
import { loanSchema, loanUpdateSchema, visibilitySchema } from '../validators.js';
import { calcJurosMensal, nowISO, safeNumber, firstCompetenciaByBase, monthRange, clampDayOfMonth } from '../utils.js';
import { nextBusinessDay } from '../businessCalendar.js';

export const loansRoutes = Router();

function mapLoan(r) {
  return { ...r, ativo: !!r.ativo, cobrar_auto: !!r.cobrar_auto };
}

loansRoutes.get('/by-client/:clientId', (req, res) => {
  const clientId = Number(req.params.clientId);
  const rows = db.prepare(`
    SELECT l.*,
      (SELECT IFNULL(SUM(valor_pago),0) FROM payments p WHERE p.loan_id=l.id) as total_recebido,
      (SELECT COUNT(*) FROM agreements a WHERE a.loan_id=l.id AND a.active=1) as acordos_ativos
    FROM loans l
    WHERE l.client_id=?
    ORDER BY l.created_at DESC
  `).all(clientId);

  res.json(rows.map(r => ({ ...mapLoan(r), total_recebido: Number(r.total_recebido||0), acordos_ativos: Number(r.acordos_ativos||0) })));
});

loansRoutes.post('/', (req, res) => {
  const parsed = loanSchema.safeParse({
    ...req.body,
    client_id: Number(req.body.client_id),
    valor_emprestimo: safeNumber(req.body.valor_emprestimo),
    juros_percent: safeNumber(req.body.juros_percent)
  });
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const d = parsed.data;
  const client = db.prepare('SELECT id FROM clients WHERE id=?').get(d.client_id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const dia_pagamento = dayjs(d.data_pagamento_base).isValid() ? dayjs(d.data_pagamento_base).date() : 1;
  const juros_mensal = calcJurosMensal(d.valor_emprestimo, d.juros_percent);
  const ts = nowISO();

  const info = db.prepare(`
    INSERT INTO loans (client_id,label,data_emprestimo,data_pagamento_base,dia_pagamento,valor_emprestimo,juros_percent,juros_mensal,ativo,cobrar_auto,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    d.client_id, d.label ?? null, d.data_emprestimo, d.data_pagamento_base, dia_pagamento,
    d.valor_emprestimo, d.juros_percent, juros_mensal,
    d.ativo === false ? 0 : 1,
    d.cobrar_auto === false ? 0 : 1,
    ts, ts
  );

  const created = db.prepare('SELECT * FROM loans WHERE id=?').get(info.lastInsertRowid);
  res.status(201).json(mapLoan(created));
});

loansRoutes.put('/:loanId', (req, res) => {
  const loanId = Number(req.params.loanId);
  const cur = db.prepare('SELECT * FROM loans WHERE id=?').get(loanId);
  if (!cur) return res.status(404).json({ error: 'Empréstimo não encontrado' });

  const merged = {
    ...cur,
    ...req.body,
    valor_emprestimo: safeNumber(req.body.valor_emprestimo ?? cur.valor_emprestimo),
    juros_percent: safeNumber(req.body.juros_percent ?? cur.juros_percent),
    client_id: cur.client_id
  };

  const parsed = loanUpdateSchema.safeParse({
    ...merged,
    client_id: cur.client_id,
    ativo: !!merged.ativo,
    cobrar_auto: !!merged.cobrar_auto
  });
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const d = parsed.data;
  const base = d.data_pagamento_base ?? cur.data_pagamento_base;
  const dia_pagamento = dayjs(base).isValid() ? dayjs(base).date() : cur.dia_pagamento;
  const valor = d.valor_emprestimo ?? cur.valor_emprestimo;
  const jp = d.juros_percent ?? cur.juros_percent;
  const juros_mensal = calcJurosMensal(valor, jp);
  const ts = nowISO();

  db.prepare(`
    UPDATE loans SET label=?, data_emprestimo=?, data_pagamento_base=?, dia_pagamento=?, valor_emprestimo=?, juros_percent=?, juros_mensal=?, ativo=?, cobrar_auto=?, updated_at=?
    WHERE id=?
  `).run(
    d.label ?? cur.label,
    d.data_emprestimo ?? cur.data_emprestimo,
    base,
    dia_pagamento,
    valor,
    jp,
    juros_mensal,
    d.ativo === false ? 0 : 1,
    d.cobrar_auto === false ? 0 : 1,
    ts,
    loanId
  );

  const updated = db.prepare('SELECT * FROM loans WHERE id=?').get(loanId);
  res.json(mapLoan(updated));
});

loansRoutes.post('/:loanId/quitacao', (req, res) => {
  const id = Number(req.params.loanId);
  const row = db.prepare('SELECT id FROM loans WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: 'Empréstimo não encontrado' });
  db.prepare('UPDATE loans SET ativo=0, cobrar_auto=0, updated_at=? WHERE id=?').run(nowISO(), id);
  res.json({ ok: true });
});

loansRoutes.post('/:loanId/reativar', (req, res) => {
  const id = Number(req.params.loanId);
  const row = db.prepare('SELECT id FROM loans WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: 'Empréstimo não encontrado' });
  db.prepare('UPDATE loans SET ativo=1, updated_at=? WHERE id=?').run(nowISO(), id);
  res.json({ ok: true });
});

loansRoutes.get('/:loanId/timeline', (req, res) => {
  const loanId = Number(req.params.loanId);
  const loan = db.prepare('SELECT * FROM loans WHERE id=?').get(loanId);
  if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado' });

  const showHidden = String(req.query.showHidden || '0') === '1';
  const from = String(req.query.from || firstCompetenciaByBase(loan.data_pagamento_base, loan.data_emprestimo));
  const to = String(req.query.to || dayjs().format('YYYY-MM'));
  const months = monthRange(from, to);

  const paidRows = db.prepare('SELECT competencia, SUM(valor_pago) total FROM payments WHERE loan_id=? AND competencia IN (' + months.map(()=>'?').join(',') + ') GROUP BY competencia')
    .all(loanId, ...months);
  const paidMap = new Map(paidRows.map(r => [r.competencia, Number(r.total||0)]));

  const visRows = db.prepare('SELECT competencia, hidden FROM loan_month_visibility WHERE loan_id=? AND competencia IN (' + months.map(()=>'?').join(',') + ')')
    .all(loanId, ...months);
  const visMap = new Map(visRows.map(r => [r.competencia, !!r.hidden]));

  const today = dayjs();
  const out = [];
  for (const m of months) {
    const hidden = visMap.get(m) || false;
    if (hidden && !showHidden) continue;

    const due = clampDayOfMonth(m, loan.dia_pagamento);
    const dueEff = nextBusinessDay(due.format('YYYY-MM-DD'));

    const paid = paidMap.get(m) || 0;
    const status = paid > 0 ? 'PAGO' : (today.isBefore(dueEff,'day') ? 'A_VENCER' : 'ABERTO');
    const atraso = status === 'ABERTO' ? Math.max(today.diff(dueEff,'day'), 0) : 0;

    out.push({
      competencia: m,
      hidden,
      due_effective: dueEff.format('YYYY-MM-DD'),
      valor_devido: Number(loan.juros_mensal||0),
      valor_pago: paid,
      status,
      atraso_dias: atraso
    });
  }

  const emAberto = out.filter(x => x.status==='ABERTO').reduce((a,b)=>a+Number(b.valor_devido||0),0);
  res.json({ loan_id: loanId, from, to, em_aberto_estimado: Number(emAberto.toFixed(2)), items: out });
});

loansRoutes.put('/:loanId/timeline/:competencia', (req, res) => {
  const loanId = Number(req.params.loanId);
  const comp = String(req.params.competencia);
  const loan = db.prepare('SELECT id FROM loans WHERE id=?').get(loanId);
  if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado' });

  const parsed = visibilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const ts = nowISO();
  const hidden = parsed.data.hidden ? 1 : 0;

  db.prepare(`
    INSERT INTO loan_month_visibility (loan_id, competencia, hidden, updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(loan_id, competencia) DO UPDATE SET hidden=excluded.hidden, updated_at=excluded.updated_at
  `).run(loanId, comp, hidden, ts);

  res.json({ ok: true, loan_id: loanId, competencia: comp, hidden: !!hidden });
});
