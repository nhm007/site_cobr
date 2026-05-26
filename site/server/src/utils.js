import dayjs from 'dayjs';

export const nowISO = () => dayjs().toISOString();
export const todayYMD = () => dayjs().format('YYYY-MM-DD');
export const monthKey = (d = dayjs()) => dayjs(d).format('YYYY-MM');

export function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function calcJurosMensal(valorEmprestimo, jurosPercent) {
  const v = Number(valorEmprestimo || 0);
  const p = Number(jurosPercent || 0);
  return Number((v * (p / 100)).toFixed(2));
}

export function clampDayOfMonth(ym, day) {
  const d = dayjs(ym + '-01');
  const dim = d.daysInMonth();
  const dd = Math.min(Math.max(Number(day || 1), 1), dim);
  return d.date(dd);
}

export function firstCompetenciaByBase(data_pagamento_base, data_emprestimo) {
  const d = dayjs(data_pagamento_base);
  if (d.isValid()) return d.format('YYYY-MM');
  const e = dayjs(data_emprestimo);
  if (e.isValid()) return e.add(1, 'month').format('YYYY-MM');
  return monthKey();
}

// ✅ sem plugin isSameOrBefore: usa !isAfter
export function monthRange(fromYM, toYM) {
  const out = [];
  let d = dayjs(fromYM + '-01');
  const end = dayjs(toYM + '-01');
  while (!d.isAfter(end, 'month')) {
    out.push(d.format('YYYY-MM'));
    d = d.add(1, 'month');
  }
  return out;
}

export function normalizePhoneDigits(raw){
  return String(raw||'').replace(/\D/g,'');
}
