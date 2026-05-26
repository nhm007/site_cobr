import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { http } from '../api/http.js';

export default function PaymentModal({ open, onClose, loanId, defaultCompetencia, onCreated }) {
  const [data_pagamento, setDate] = useState('');
  const [valor_pago, setValor] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [manualComp, setManualComp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(dayjs().format('YYYY-MM-DD'));
    setValor('');
    if (defaultCompetencia) { setManualComp(true); setCompetencia(defaultCompetencia); }
    else { setManualComp(false); setCompetencia(dayjs().format('YYYY-MM')); }
  }, [open, defaultCompetencia]);

  useEffect(() => {
    if (!data_pagamento || manualComp) return;
    setCompetencia(dayjs(data_pagamento).format('YYYY-MM'));
  }, [data_pagamento, manualComp]);

  if (!open) return null;

  async function save() {
    const payload = { loan_id: loanId, data_pagamento, valor_pago: Number(valor_pago) };
    if (manualComp && competencia) payload.competencia = competencia;
    await http.post('/payments', payload);
    onCreated?.();
    onClose?.();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-2xl border w-full max-w-md p-4 shadow-soft">
        <div className="font-bold text-lg mb-3">Adicionar pagamento (juros mensal)</div>
        <div className="space-y-2">
          <div><label className="text-sm">Data do pagamento</label><input type="date" className="w-full border rounded-lg px-3 py-2" value={data_pagamento} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="text-sm">Valor pago</label><input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" value={valor_pago} onChange={e => setValor(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={manualComp} onChange={e => setManualComp(e.target.checked)} />Definir competência manualmente</label>
          <div><label className="text-sm">Competência</label><input type="month" className={`w-full border rounded-lg px-3 py-2 ${manualComp ? '' : 'bg-slate-50'}`} value={competencia} onChange={e => setCompetencia(e.target.value)} disabled={!manualComp} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button className="px-3 py-2 rounded-lg border" onClick={onClose}>Cancelar</button><button className="px-3 py-2 rounded-lg bg-emerald-600 text-white" onClick={save}>Salvar</button></div>
      </div>
    </div>
  );
}
