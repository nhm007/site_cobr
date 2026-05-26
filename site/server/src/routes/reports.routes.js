import { Router } from 'express';
import dayjs from 'dayjs';
import { db } from '../db.js';
import { monthKey, clampDayOfMonth, firstCompetenciaByBase, normalizePhoneDigits } from '../utils.js';
import { nextBusinessDay, isBusinessDay } from '../businessCalendar.js';

export const reportsRoutes = Router();

function buildMensalMessage(nome, valor, venc, label) {
  const tag = label ? ` (${label})` : '';
  return `Olá, ${nome}! 👋

Seu pagamento do juros mensal${tag} está em aberto.
Valor: R$ ${Number(valor||0).toFixed(2)}
Vencimento: ${venc}

Por favor, assim que realizar, confirme. Obrigado!`;
}

reportsRoutes.get('/due', (req, res) => {
  const dateStr = String(req.query.date || dayjs().format('YYYY-MM-DD'));
  const mode = String(req.query.mode || 'both');
  const includePaid = String(req.query.includePaid || '0') === '1';

  const ref = dayjs(dateStr);
  if (!ref.isValid()) return res.status(400).json({ error: 'date inválida' });

  const comp = monthKey(ref);

  const loans = db.prepare(`
    SELECT l.*, c.nome, c.telefone
    FROM loans l
    JOIN clients c ON c.id=l.client_id
    WHERE l.ativo=1
    ORDER BY c.nome ASC
  `).all();

  const paidRows = db.prepare('SELECT loan_id, competencia FROM payments WHERE competencia=?').all(comp);
  const paidSet = new Set(paidRows.map(r => `${r.loan_id}:${r.competencia}`));

  const out = [];
  for (const l of loans) {
    const dueDate = clampDayOfMonth(comp, l.dia_pagamento);
    const dueEff = nextBusinessDay(dueDate.format('YYYY-MM-DD'));

    const matchCalendar = dueDate.format('YYYY-MM-DD') === dateStr;
    const matchEffective = dueEff.format('YYYY-MM-DD') === dateStr;

    let include = false;
    if (mode === 'calendar') include = matchCalendar;
    else if (mode === 'effective') include = matchEffective;
    else include = matchCalendar || matchEffective;

    if (!include) continue;

    const paid = paidSet.has(`${l.id}:${comp}`);
    if (!includePaid && paid) continue;

    const venc = dueEff.format('DD/MM/YYYY');
    out.push({
      client_id: l.client_id,
      client_nome: l.nome,
      telefone: l.telefone,
      telefone_digits: normalizePhoneDigits(l.telefone),
      loan_id: l.id,
      loan_label: l.label || null,
      competencia: comp,
      due_date: dueDate.format('YYYY-MM-DD'),
      due_effective: dueEff.format('YYYY-MM-DD'),
      is_business_day: isBusinessDay(dateStr),
      juros_mensal: Number(l.juros_mensal || 0),
      status: paid ? 'PAGO' : 'ABERTO',
      mensagem: paid ? null : buildMensalMessage(l.nome, l.juros_mensal, venc, l.label)
    });
  }

  res.json({ date: dateStr, competencia: comp, mode, includePaid, items: out });
});

// ✅ Resumo do mês para calendário (grade)
reportsRoutes.get('/due-month', (req, res) => {
  const month = String(req.query.month || dayjs().format('YYYY-MM'));
  const mode = String(req.query.mode || 'both');
  const includePaid = String(req.query.includePaid || '0') === '1';

  const m = dayjs(month + '-01');
  if (!m.isValid()) return res.status(400).json({ error: 'month inválido' });

  const comp = monthKey(m);

  const loans = db.prepare(`
    SELECT l.*, c.nome, c.telefone
    FROM loans l
    JOIN clients c ON c.id=l.client_id
    WHERE l.ativo=1
  `).all();

  const paidRows = db.prepare('SELECT loan_id, competencia FROM payments WHERE competencia=?').all(comp);
  const paidSet = new Set(paidRows.map(r => `${r.loan_id}:${r.competencia}`));

  const daysInMonth = m.daysInMonth();
  const days = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = m.date(day).format('YYYY-MM-DD');

    let total = 0;
    let open = 0;

    for (const l of loans) {
      const dueDate = clampDayOfMonth(comp, l.dia_pagamento);
      const dueEff = nextBusinessDay(dueDate.format('YYYY-MM-DD'));

      const matchCalendar = dueDate.format('YYYY-MM-DD') === dateStr;
      const matchEffective = dueEff.format('YYYY-MM-DD') === dateStr;

      let include = false;
      if (mode === 'calendar') include = matchCalendar;
      else if (mode === 'effective') include = matchEffective;
      else include = matchCalendar || matchEffective;

      if (!include) continue;

      const paid = paidSet.has(`${l.id}:${comp}`);
      if (!includePaid && paid) continue;

      total += 1;
      if (!paid) open += 1;
    }

    days.push({ date: dateStr, competencia: comp, total, open, is_business_day: isBusinessDay(dateStr) });
  }

  res.json({ month, competencia: comp, mode, includePaid, days });
});

reportsRoutes.get('/overdue', (req, res) => {
  const asOfStr = String(req.query.asOf || dayjs().format('YYYY-MM-DD'));
  const asOf = dayjs(asOfStr);
  if (!asOf.isValid()) return res.status(400).json({ error: 'asOf inválido' });

  const endComp = monthKey(asOf);

  const loans = db.prepare(`
    SELECT l.*, c.nome, c.telefone
    FROM loans l
    JOIN clients c ON c.id=l.client_id
    WHERE l.ativo=1
    ORDER BY c.nome ASC
  `).all();

  const paid = db.prepare('SELECT loan_id, competencia FROM payments').all();
  const paidMap = new Map();
  for (const r of paid) {
    if (!paidMap.has(r.loan_id)) paidMap.set(r.loan_id, new Set());
    paidMap.get(r.loan_id).add(r.competencia);
  }

  const out = [];

  for (const l of loans) {
    const firstComp = firstCompetenciaByBase(l.data_pagamento_base, l.data_emprestimo);
    let d = dayjs(firstComp + '-01');
    const end = dayjs(endComp + '-01');

    const paidSet = paidMap.get(l.id) || new Set();
    let overdueCount = 0;
    let oldestComp = null;
    let oldestDueEff = null;

    while (!d.isAfter(end, 'month')) {
      const comp = d.format('YYYY-MM');
      const dueDate = clampDayOfMonth(comp, l.dia_pagamento);
      const dueEff = nextBusinessDay(dueDate.format('YYYY-MM-DD'));
      const dueReached = asOf.isAfter(dueEff, 'day') || asOf.isSame(dueEff, 'day');
      if (dueReached) {
        const isPaid = paidSet.has(comp);
        if (!isPaid) {
          overdueCount += 1;
          if (!oldestComp) {
            oldestComp = comp;
            oldestDueEff = dueEff;
          }
        }
      }
      d = d.add(1,'month');
    }

    if (overdueCount <= 0) continue;

    const total = Number((overdueCount * Number(l.juros_mensal || 0)).toFixed(2));
    const atrasoDias = oldestDueEff ? Math.max(asOf.diff(oldestDueEff, 'day'), 0) : 0;

    out.push({
      client_id: l.client_id,
      client_nome: l.nome,
      telefone: l.telefone,
      telefone_digits: normalizePhoneDigits(l.telefone),
      loan_id: l.id,
      loan_label: l.label || null,
      juros_mensal: Number(l.juros_mensal || 0),
      overdue_count: overdueCount,
      overdue_total: total,
      oldest_competencia: oldestComp,
      oldest_due_effective: oldestDueEff ? oldestDueEff.format('YYYY-MM-DD') : null,
      atraso_dias: atrasoDias,
      mensagem: buildMensalMessage(l.nome, l.juros_mensal, oldestDueEff ? oldestDueEff.format('DD/MM/YYYY') : asOf.format('DD/MM/YYYY'), l.label)
    });
  }

  out.sort((a,b) => (b.overdue_total - a.overdue_total) || (b.atraso_dias - a.atraso_dias));
  res.json({ asOf: asOfStr, competencia_atual: endComp, items: out });
});
