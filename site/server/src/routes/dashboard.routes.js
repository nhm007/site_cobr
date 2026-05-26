import { Router } from 'express';
import { db } from '../db.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/', (req, res) => {
  const totalClients = db.prepare('SELECT COUNT(*) n FROM clients').get().n;
  const totalLoans = db.prepare('SELECT COUNT(*) n FROM loans').get().n;
  const totalLoansActive = db.prepare('SELECT COUNT(*) n FROM loans WHERE ativo=1').get().n;
  const totalPaid = db.prepare('SELECT IFNULL(SUM(valor_pago),0) s FROM payments').get().s;
  const totalBorrowed = db.prepare('SELECT IFNULL(SUM(valor_emprestimo),0) s FROM loans').get().s;
  res.json({ totals: { totalClients, totalLoans, totalLoansActive, totalPaid, totalBorrowed } });
});
