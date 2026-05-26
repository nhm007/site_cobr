import dayjs from 'dayjs';
import Holidays from 'date-holidays';
import dotenv from 'dotenv';

dotenv.config();

const hd = new Holidays('BR', 'SP');
try { hd.init('BR', 'SP', 'São Paulo'); } catch {}

const extra = (process.env.EXTRA_HOLIDAYS || '').split(',').map(s=>s.trim()).filter(Boolean);

export function isBusinessDay(dateYMD) {
  const d = dayjs(dateYMD);
  if (!d.isValid()) return false;
  const dow = d.day();
  if (dow === 0 || dow === 6) return false;
  if (extra.includes(d.format('YYYY-MM-DD'))) return false;
  return !hd.isHoliday(d.toDate());
}

export function nextBusinessDay(dateYMD) {
  let d = dayjs(dateYMD);
  for (let i=0;i<366;i++) {
    if (isBusinessDay(d.format('YYYY-MM-DD'))) return d;
    d = d.add(1,'day');
  }
  return dayjs(dateYMD);
}
