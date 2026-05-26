import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import { http } from '../api/http.js';
import { brl } from '../lib/money.js';

function waLink(phoneDigits, msg){
  const to = String(phoneDigits||'').replace(/\D/g,'');
  const text = encodeURIComponent(msg||'');
  return `https://wa.me/${to}?text=${text}`;
}

function copyToClipboard(text){
  if(!text) return;
  navigator.clipboard?.writeText(text)
    .then(()=>alert('Mensagem copiada!'))
    .catch(()=>alert('Não foi possível copiar automaticamente.'));
}

function DayCell({ day, selected, onSelect }) {
  const d = dayjs(day.date);
  const isToday = d.isSame(dayjs(), 'day');
  const isWeekend = [0,6].includes(d.day());

  const ring = selected ? 'ring-2 ring-slate-900' : '';
  const bg = isToday ? 'bg-amber-50' : 'bg-white';
  const faded = isWeekend ? 'text-slate-400' : 'text-slate-700';

  return (
    <button
      onClick={() => onSelect(day.date)}
      className={`relative border rounded-xl p-2 text-left hover:bg-slate-50 ${bg} ${ring}`}
      title={day.date}
    >
      <div className={`text-sm font-semibold ${faded}`}>{d.date()}</div>
      {day.open > 0 ? (
        <div className="mt-1 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{day.open} em aberto</div>
      ) : day.total > 0 ? (
        <div className="mt-1 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">{day.total} pago</div>
      ) : (
        <div className="mt-1 text-xs text-slate-400">—</div>
      )}
      {!day.is_business_day ? (
        <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600">não útil</div>
      ) : null}
    </button>
  );
}

export default function Calendario() {
  const { openMenu } = useOutletContext();

  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  const [mode, setMode] = useState('both');
  const [includePaid, setIncludePaid] = useState(false);

  const [monthData, setMonthData] = useState(null);
  const [dayData, setDayData] = useState(null);
  const [err, setErr] = useState('');

  const detailRef = useRef(null);

  const monthStart = useMemo(() => dayjs(month + '-01'), [month]);

  const gridDays = useMemo(() => {
    const start = monthStart.startOf('month').startOf('week');
    const end = monthStart.endOf('month').endOf('week');
    const days = [];
    let d = start;
    while (!d.isAfter(end, 'day')) {
      days.push(d.format('YYYY-MM-DD'));
      d = d.add(1,'day');
    }
    return days;
  }, [monthStart]);

  const monthMap = useMemo(() => {
    const m = new Map();
    (monthData?.days || []).forEach(x => m.set(x.date, x));
    return m;
  }, [monthData]);

  async function loadMonth(m = month) {
    setErr('');
    try {
      const r = await http.get(`/reports/due-month?month=${m}&mode=${mode}&includePaid=${includePaid?1:0}`);
      setMonthData(r);
    } catch (e) {
      setErr(e.message);
      setMonthData(null);
    }
  }

  async function loadDay(dateStr = selectedDate) {
    setErr('');
    try {
      const r = await http.get(`/reports/due?date=${dateStr}&mode=${mode}&includePaid=${includePaid?1:0}`);
      setDayData(r);
    } catch (e) {
      setErr(e.message);
      setDayData(null);
    }
  }

  useEffect(() => {
    loadMonth(month);
    loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sel = dayjs(selectedDate);
    if (!sel.isValid() || sel.format('YYYY-MM') !== month) {
      const newSel = monthStart.format('YYYY-MM-01');
      setSelectedDate(newSel);
    }
    loadMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, mode, includePaid]);

  useEffect(() => {
    loadDay(selectedDate);
    // scroll automático para a lista de clientes do dia
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, includePaid]);

  function prevMonth() { setMonth(monthStart.subtract(1,'month').format('YYYY-MM')); }
  function nextMonth() { setMonth(monthStart.add(1,'month').format('YYYY-MM')); }

  const selectedInfo = monthMap.get(selectedDate) || { date: selectedDate, total: 0, open: 0, is_business_day: true };

  return (
    <div>
      <Topbar title="Calendário" onMenu={openMenu} right={<button className="px-3 py-2 rounded-lg border" onClick={() => { loadMonth(month); loadDay(selectedDate); }}>Atualizar</button>} />

      <div className="p-4 max-w-[1600px] mx-auto space-y-3">
        <div className="bg-white border rounded-2xl p-4 shadow-soft space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
            <div className="flex items-end gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={prevMonth}>◀</button>
              <div>
                <label className="text-sm">Mês</label>
                <input type="month" className="border rounded-lg px-3 py-2" value={month} onChange={e=>setMonth(e.target.value)} />
              </div>
              <button className="px-3 py-2 rounded-lg border" onClick={nextMonth}>▶</button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div>
                <label className="text-sm">Modo</label>
                <select className="border rounded-lg px-3 py-2" value={mode} onChange={e=>setMode(e.target.value)}>
                  <option value="both">Data do mês OU vencimento efetivo</option>
                  <option value="calendar">Somente data do mês (inclui fins de semana/feriados)</option>
                  <option value="effective">Somente vencimento efetivo (dia útil)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includePaid} onChange={e=>setIncludePaid(e.target.checked)} />
                Incluir pagos
              </label>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-xs text-slate-500">
            <div className="text-center">Dom</div><div className="text-center">Seg</div><div className="text-center">Ter</div><div className="text-center">Qua</div><div className="text-center">Qui</div><div className="text-center">Sex</div><div className="text-center">Sáb</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {gridDays.map(d => {
              const inMonth = dayjs(d).format('YYYY-MM') === month;
              const info = monthMap.get(d) || { date: d, total: 0, open: 0, is_business_day: true };
              return (
                <div key={d} className={inMonth ? '' : 'opacity-40'}>
                  <DayCell day={info} selected={d===selectedDate} onSelect={setSelectedDate} />
                </div>
              );
            })}
          </div>

          <div className="text-xs text-slate-500">Clique em um dia para ir direto para a lista de clientes que devem pagar naquele dia.</div>
        </div>

        {err ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3">Erro: {err}</div> : null}

        <div ref={detailRef} className="bg-white border rounded-2xl p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-bold">Clientes do dia: {dayjs(selectedDate).format('DD/MM/YYYY')}</div>
              <div className="text-xs text-slate-500">Em aberto: {selectedInfo.open} • Total: {selectedInfo.total} • Competência: {monthData?.competencia || '-'}</div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-lg border" onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}>Hoje</button>
              <button className="px-3 py-2 rounded-lg border" onClick={() => loadDay(selectedDate)}>Recarregar</button>
            </div>
          </div>

          {!dayData ? (
            <div className="text-slate-500 mt-3">Carregando...</div>
          ) : (
            <div className="mt-3 overflow-auto">
              <table className="min-w-[1050px] w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Cliente</th>
                    <th>Empréstimo</th>
                    <th>Valor</th>
                    <th>Data do mês</th>
                    <th>Venc. efetivo</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {dayData.items.map(it => (
                    <tr key={it.loan_id} className="border-b">
                      <td className="py-2"><div className="font-semibold">{it.client_nome}</div><div className="text-xs text-slate-500">{it.telefone}</div></td>
                      <td>{it.loan_label || `#${it.loan_id}`}</td>
                      <td>{brl(it.juros_mensal)}</td>
                      <td className="text-xs">{it.due_date}</td>
                      <td className="text-xs">{it.due_effective}</td>
                      <td><span className={`text-xs px-2 py-1 rounded-full ${it.status==='PAGO'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{it.status}</span></td>
                      <td className="py-2">
                        {it.status==='ABERTO' ? (
                          <div className="flex gap-2">
                            <button className="text-xs px-2 py-1 rounded-lg border" onClick={()=>copyToClipboard(it.mensagem)}>Copiar</button>
                            <a className="text-xs px-2 py-1 rounded-lg bg-emerald-600 text-white" href={waLink(it.telefone_digits, it.mensagem)} target="_blank" rel="noreferrer">WhatsApp</a>
                          </div>
                        ) : <span className="text-xs text-slate-400">-</span>}
                      </td>
                    </tr>
                  ))}
                  {!dayData.items.length ? (
                    <tr><td className="py-4 text-slate-500" colSpan={7}>Nenhuma cobrança para este dia.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
