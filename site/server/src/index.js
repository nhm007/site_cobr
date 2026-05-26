import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { initSchema } from './schema.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';

import { authRoutes } from './routes/auth.routes.js';
import { clientsRoutes } from './routes/clients.routes.js';
import { loansRoutes } from './routes/loans.routes.js';
import { paymentsRoutes } from './routes/payments.routes.js';
import { agreementsRoutes } from './routes/agreements.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { filesRoutes } from './routes/files.routes.js';

import { startScheduler } from './jobs/scheduler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3333;

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));

initSchema();

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/clients', requireAuth, clientsRoutes);
app.use('/loans', requireAuth, loansRoutes);
app.use('/payments', requireAuth, paymentsRoutes);
app.use('/agreements', requireAuth, agreementsRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/reports', requireAuth, reportsRoutes);
app.use('/files', requireAuth, filesRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
  startScheduler();
});
