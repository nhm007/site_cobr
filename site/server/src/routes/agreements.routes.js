import { Router } from 'express';
import dayjs from 'dayjs';
import { db } from '../db.js';
import { agreementCreateSchema, agreementUpdateSchema, agreementSettingsSchema, agreementPaySchema } from '../validators.js';
import { nowISO, clampDayOfMonth } from '../utils.js';
import { nextBusinessDay } from '../businessCalendar.js';

export const agreementsRoutes = Router();

function mapAgreement(a) {
  return { ...a, active: !!a.active, auto_charge: !!a.auto_charge };
}

agreementsRoutes.get('/', (req, res) => {
  const clientId = req.query.client_id ? Number(req.query.client_id) : null;
  const sql = `
    SELECT a.*, l.label as loan_label, l.ativo as loan_ativo,
           c.id as client_id, c.nome as client_nome, c.cpf as client_cpf, c.telefone as client_telefone
    FROM agreements a
    JOIN loans l ON l.id=a.loan_id
    JOIN clients c ON c.id=l.client_id
    ${clientId ? 'WHERE c.id=?' : ''}
    ORDER BY a.active DESC, a.updated_at DESC
  `;
  const rows = clientId ? db.prepare(sql).all(clientId) : db.prepare(sql).all();
  res.json(rows.map(mapAgreement));
});

agreementsRoutes.post('/from-loan', (req, res) => {
  const parsed = agreementCreateSchema.safeParse({ loan_id: Number(req.body?.loan_id) });
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const { loan_id } = parsed.data;
  const loan = db.prepare('SELECT * FROM loans WHERE id=?').get(loan_id);
  if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado' });
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(loan.client_id);

  const ts = nowISO();
  const title = `Acordo - ${client?.nome || ''}${loan.label ? ' ('+loan.label+')' : ''}`;
  const info = db.prepare(`
    INSERT INTO agreements (loan_id, title, first_due_date, due_day, installment_count, installment_amount, auto_charge, active, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(loan_id, title, null, null, null, null, 1, 1, ts, ts);

  const created = db.prepare('SELECT * FROM agreements WHERE id=?').get(info.lastInsertRowid);
  res.status(201).json(mapAgreement(created));
});

agreementsRoutes.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT a.*, l.label as loan_label, l.ativo as loan_ativo,
           c.id as client_id, c.nome as client_nome, c.cpf as client_cpf, c.telefone as client_telefone
    FROM agreements a
    JOIN loans l ON l.id=a.loan_id
    JOIN clients c ON c.id=l.client_id
    WHERE a.id=?
  `).get(id);
  if (!row) return res.status(404).json({ error: 'Acordo não encontrado' });
  res.json(mapAgreement(row));
});

function regenerateInstallments(agreementId, count, amount, firstDueDate) {
  const first = dayjs(firstDueDate);
  if (!first.isValid()) throw new Error('first_due_date inválida');
  const dueDay = first.date();

  const paidExists = db.prepare("SELECT 1 FROM agreement_installments WHERE agreement_id=? AND status='PAID' LIMIT 1").get(agreementId);
  if (paidExists) throw new Error('Já existem parcelas pagas. Para alterar, crie um novo acordo.');

  db.prepare('DELETE FROM agreement_installments WHERE agreement_id=?').run(agreementId);

  const ts = nowISO();
  const stmt = db.prepare(`
    INSERT INTO agreement_installments (agreement_id, n, due_date, due_effective, amount, status, paid_date, paid_amount, created_at, updated_at)
    VALUES (?,?,?,?,?,'OPEN',NULL,NULL,?,?)
  `);

  for (let i=0;i<count;i++) {
    const ym = first.add(i,'month').format('YYYY-MM');
    const due = clampDayOfMonth(ym, dueDay);
    const dueEff = nextBusinessDay(due.format('YYYY-MM-DD'));
    stmt.run(agreementId, i+1, due.format('YYYY-MM-DD'), dueEff.format('YYYY-MM-DD'), amount, ts, ts);
  }

  return { dueDay };
}

agreementsRoutes.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare('SELECT * FROM agreements WHERE id=?').get(id);
  if (!current) return res.status(404).json({ error: 'Acordo não encontrado' });

  const parsed = agreementUpdateSchema.safeParse({
    installment_count: Number(req.body?.installment_count),
    installment_amount: Number(req.body?.installment_amount),
    first_due_date: String(req.body?.first_due_date || ''),
    auto_charge: typeof req.body?.auto_charge === 'boolean' ? req.body.auto_charge : undefined,
    active: typeof req.body?.active === 'boolean' ? req.body.active : undefined
  });
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const d = parsed.data;
  const tx = db.transaction(() => {
    const regen = regenerateInstallments(id, d.installment_count, d.installment_amount, d.first_due_date);
    const ts = nowISO();
    const auto_charge = typeof d.auto_charge === 'boolean' ? (d.auto_charge ? 1 : 0) : current.auto_charge;
    const active = typeof d.active === 'boolean' ? (d.active ? 1 : 0) : current.active;

    db.prepare(`
      UPDATE agreements SET first_due_date=?, due_day=?, installment_count=?, installment_amount=?, auto_charge=?, active=?, updated_at=?
      WHERE id=?
    `).run(d.first_due_date, regen.dueDay, d.installment_count, d.installment_amount, auto_charge, active, ts, id);
  });

  try {
    tx();
    const updated = db.prepare('SELECT * FROM agreements WHERE id=?').get(id);
    res.json(mapAgreement(updated));
  } catch (e) {
    res.status(400).json({ error: 'Falha ao atualizar acordo', details: String(e.message||e) });
  }
});

agreementsRoutes.put('/:id/settings', (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare('SELECT * FROM agreements WHERE id=?').get(id);
  if (!current) return res.status(404).json({ error: 'Acordo não encontrado' });

  const parsed = agreementSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const ts = nowISO();
  const auto_charge = typeof parsed.data.auto_charge === 'boolean' ? (parsed.data.auto_charge ? 1 : 0) : current.auto_charge;
  const active = typeof parsed.data.active === 'boolean' ? (parsed.data.active ? 1 : 0) : current.active;

  db.prepare('UPDATE agreements SET auto_charge=?, active=?, updated_at=? WHERE id=?').run(auto_charge, active, ts, id);
  const updated = db.prepare('SELECT * FROM agreements WHERE id=?').get(id);
  res.json(mapAgreement(updated));
});

agreementsRoutes.get('/:id/installments', (req, res) => {
  const id = Number(req.params.id);
  const a = db.prepare('SELECT * FROM agreements WHERE id=?').get(id);
  if (!a) return res.status(404).json({ error: 'Acordo não encontrado' });

  const rows = db.prepare('SELECT * FROM agreement_installments WHERE agreement_id=? ORDER BY n ASC').all(id);
  res.json(rows.map(r => ({ ...r, is_paid: r.status === 'PAID' })));
});

agreementsRoutes.post('/installments/:instId/pay', (req, res) => {
  const instId = Number(req.params.instId);
  const inst = db.prepare('SELECT * FROM agreement_installments WHERE id=?').get(instId);
  if (!inst) return res.status(404).json({ error: 'Parcela não encontrada' });

  const parsed = agreementPaySchema.safeParse({
    data_pagamento: String(req.body?.data_pagamento || ''),
    valor_pago: Number(req.body?.valor_pago)
  });
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const ts = nowISO();
  db.prepare(`UPDATE agreement_installments SET status='PAID', paid_date=?, paid_amount=?, updated_at=? WHERE id=?`)
    .run(parsed.data.data_pagamento, parsed.data.valor_pago, ts, instId);

  const updated = db.prepare('SELECT * FROM agreement_installments WHERE id=?').get(instId);
  res.json({ ...updated, is_paid: true });
});
