import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { http } from '../api/http.js';

export default function InstallmentPayModal({ open, onClose, installment, onPaid }) {
  const [data_pagamento, setDate] = useState('');
  const [valor_pago, setValor] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(dayjs().format('YYYY-MM-DD'));
    setValor(installment ? String(installment.amount) : '');
  }, [open, installment]);

  if (!open) return null;

  async function pay() {
    await http.post(`/agreements/installments/${installment.id}/pay`, { data_pagamento, valor_pago: Number(valor_pago) });
    onPaid?.();
    onClose?.();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border w-full max-w-md p-4 shadow-soft">
        <div className="font-bold text-lg mb-3">Marcar parcela como paga</div>
        <div className="text-sm text-slate-600 mb-3">Parcela {installment?.n} • Venc.: {installment?.due_effective}</div>
        <div className="space-y-2">
          <div><label className="text-sm">Data do pagamento</label><input type="date" className="w-full border rounded-lg px-3 py-2" value={data_pagamento} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="text-sm">Valor pago</label><input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" value={valor_pago} onChange={e => setValor(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button className="px-3 py-2 rounded-lg border" onClick={onClose}>Cancelar</button><button className="px-3 py-2 rounded-lg bg-emerald-600 text-white" onClick={pay}>Salvar</button></div>
      </div>
    </div>
  );
}
