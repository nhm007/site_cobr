import { Router } from 'express';
import { loginSchema } from '../validators.js';
import { checkAdminCredentials, signToken } from '../auth.js';

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const { user, pass } = parsed.data;
  if (!checkAdminCredentials(user, pass)) return res.status(401).json({ error: 'Usuário/senha inválidos' });
  res.json({ token: signToken({ user, role: 'admin' }) });
});
