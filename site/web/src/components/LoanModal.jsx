import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { http } from '../api/http.js';

export default function LoanModal({ open, onClose, clientId, onCreated }) {
  const [label, setLabel] = useState('');
  const [dataEmp, setDataEmp] = useState('');
  const [dataBase, setDataBase] = useState('');
  const [valor, setValor] = useState('');
  const [juros, setJuros] = useState('');
  const [cobrarAuto, setCobrarAuto] = useState(true);

  const jurosMensal = useMemo(() => {
    const v = Number(valor || 0);
    const p = Number(juros || 0);
    return Number((v * (p / 100)).toFixed(2));
  }, [valor, juros]);

  useEffect(() => {
    if (!open) return;
    setLabel('');
    setDataEmp(dayjs().format('YYYY-MM-DD'));
    setDataBase(dayjs().add(1,'month').format('YYYY-MM-DD'));
    setValor('');
    setJuros('');
    setCobrarAuto(true);
  }, [open]);

  if (!open) return null;

  async function save() {
    await http.post('/loans', {
      client_id: clientId,
      label: label || null,
      data_emprestimo: dataEmp,
      data_pagamento_base: dataBase,
      valor_emprestimo: Number(valor),
      juros_percent: Number(juros),
      cobrar_auto: !!cobrarAuto
    });
    onCreated?.();
    onClose?.();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border w-full max-w-lg p-4 shadow-soft">
        <div className="font-bold text-lg mb-3">Novo empréstimo</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label className="text-sm">Etiqueta (opcional)</label><input className="w-full border rounded-lg px-3 py-2" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Ex: Empréstimo 2 / Extra" /></div>
          <div><label className="text-sm">Data do empréstimo</label><input type="date" className="w-full border rounded-lg px-3 py-2" value={dataEmp} onChange={e=>setDataEmp(e.target.value)} /></div>
          <div><label className="text-sm">Data base de pagamento</label><input type="date" className="w-full border rounded-lg px-3 py-2" value={dataBase} onChange={e=>setDataBase(e.target.value)} /></div>
          <div><label className="text-sm">Valor emprestado</label><input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" value={valor} onChange={e=>setValor(e.target.value)} /></div>
          <div><label className="text-sm">% juros</label><input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" value={juros} onChange={e=>setJuros(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="bg-slate-100 rounded-xl px-4 py-3"><div className="text-xs text-slate-500">Juros mensal (calc.)</div><div className="font-bold">R$ {jurosMensal.toFixed(2)}</div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cobrarAuto} onChange={e=>setCobrarAuto(e.target.checked)} /> Cobrança automática</label>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button className="px-3 py-2 rounded-lg border" onClick={onClose}>Cancelar</button><button className="px-3 py-2 rounded-lg bg-emerald-600 text-white" onClick={save}>Criar</button></div>
      </div>
    </div>
  );
}
