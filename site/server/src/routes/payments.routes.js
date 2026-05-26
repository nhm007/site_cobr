import { Router } from 'express';
import dayjs from 'dayjs';
import { db } from '../db.js';
import { paymentSchema } from '../validators.js';
import { monthKey, nowISO, safeNumber } from '../utils.js';

export const paymentsRoutes = Router();

paymentsRoutes.post('/', (req, res) => {
  const parsed = paymentSchema.safeParse({
    ...req.body,
    loan_id: Number(req.body.loan_id),
    valor_pago: safeNumber(req.body.valor_pago)
  });
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });

  const { loan_id, data_pagamento, valor_pago, competencia: compIn } = parsed.data;
  const loan = db.prepare('SELECT id FROM loans WHERE id=?').get(loan_id);
  if (!loan) return res.status(404).json({ error: 'Empréstimo não encontrado' });

  const competencia = compIn || monthKey(dayjs(data_pagamento));
  const ts = nowISO();

  const info = db.prepare('INSERT INTO payments (loan_id,data_pagamento,valor_pago,competencia,created_at) VALUES (?,?,?,?,?)')
    .run(loan_id, data_pagamento, valor_pago, competencia, ts);

  const created = db.prepare('SELECT * FROM payments WHERE id=?').get(info.lastInsertRowid);
  res.status(201).json(created);
});
