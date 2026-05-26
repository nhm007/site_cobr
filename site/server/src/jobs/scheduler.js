import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

export function startScheduler() {
  const tz = process.env.CRON_TZ || 'America/Sao_Paulo';
  const expr = process.env.CRON_EXPR || '0 8 * * *';
  if (!cron.validate(expr)) {
    console.warn('[CRON] expressão inválida, scheduler desabilitado:', expr);
    return;
  }
  cron.schedule(expr, async () => {
    // Job automático opcional
  }, { timezone: tz });
  console.log(`[CRON] agendado: ${expr} TZ=${tz}`);
}
