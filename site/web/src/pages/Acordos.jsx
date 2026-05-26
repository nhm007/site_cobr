import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useLocation, useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import { http } from '../api/http.js';
import { brl } from '../lib/money.js';
import InstallmentPayModal from '../components/InstallmentPayModal.jsx';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function pillClass(status, overdue) {
  if (status === 'PAID') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (overdue) return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function Acordos() {
  const { openMenu } = useOutletContext();
  const q = useQuery();
  const openId = q.get('open');
  const clientId = q.get('client_id');

  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [installments, setInstallments] = useState([]);

  const [count, setCount] = useState('12');
  const [amount, setAmount] = useState('200');
  const [firstDue, setFirstDue] = useState(dayjs().format('YYYY-MM-DD'));

  const [payOpen, setPayOpen] = useState(false);
  const [payInst, setPayInst] = useState(null);

  async function load() {
    const url = clientId ? `/agreements?client_id=${clientId}` : '/agreements';
    const l = await http.get(url);
    setList(l);
  }

  async function loadInstallments(agreementId) {
    const inst = await http.get(`/agreements/${agreementId}/installments`);
    setInstallments(inst);
  }

  useEffect(() => { load(); }, [clientId]); // eslint-disable-line

  useEffect(() => {
    if (!openId || !list.length) return;
    const a = list.find(x => String(x.id) === String(openId));
    if (a) selectAgreement(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, list]);

  async function selectAgreement(a) {
    setSelected(a);
    setInstallments([]);
    const full = await http.get(`/agreements/${a.id}`);
    setSelected(full);
    if (full.installment_count) setCount(String(full.installment_count));
    if (full.installment_amount) setAmount(String(full.installment_amount));
    if (full.first_due_date) setFirstDue(full.first_due_date);
    await loadInstallments(a.id);
  }

  async function saveAgreement() {
    if (!selected) return;
    const payload = { installment_count: Number(count), installment_amount: Number(amount), first_due_date: firstDue };
    const upd = await http.put(`/agreements/${selected.id}`, payload);
    setSelected(upd);
    await load();
    await loadInstallments(selected.id);
  }

  async function toggleAutoCharge() {
    if (!selected) return;
    const upd = await http.put(`/agreements/${selected.id}/settings`, { auto_charge: !selected.auto_charge });
    setSelected(upd);
    await load();
  }

  async function toggleActive() {
    if (!selected) return;
    const upd = await http.put(`/agreements/${selected.id}/settings`, { active: !selected.active });
    setSelected(upd);
    await load();
  }

  async function afterPaid() {
    if (!selected) return;
    await loadInstallments(selected.id);
  }

  const today = dayjs().format('YYYY-MM-DD');

  return (
    <div>
      <Topbar title="Acordos" onMenu={openMenu} right={<button className="px-3 py-2 rounded-lg border" onClick={load}>Atualizar</button>} />

      <div className="p-4 max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-white border rounded-2xl shadow-soft overflow-hidden">
          <div className="p-3 border-b">
            <div className="font-semibold">Acordos</div>
            <div className="text-xs text-slate-500">{clientId ? 'Filtrado por cliente' : 'Todos os acordos'}</div>
          </div>
          <div className="max-h-[72vh] overflow-auto">
            {list.map(a => (
              <button key={a.id} onClick={() => selectAgreement(a)} className={`w-full text-left p-3 border-b hover:bg-slate-50 ${selected?.id === a.id ? 'bg-slate-100' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold truncate">{a.title || `Acordo #${a.id}`}</div>
                  <span className={`text-xs px-2 py-1 rounded-full ${a.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{a.active ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">{a.client_nome} • {a.loan_label ? `Empréstimo: ${a.loan_label}` : 'Empréstimo'} </div>
                <div className="text-xs text-slate-500 truncate">Parc.: {a.installment_count || '-'} • Valor: {a.installment_amount ? brl(a.installment_amount) : '-'}</div>
              </button>
            ))}
            {!list.length ? <div className="p-4 text-sm text-slate-500">Nenhum acordo.</div> : null}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border rounded-2xl shadow-soft p-4">
          {!selected ? (
            <div className="text-slate-500">Selecione um acordo para configurar parcelas e ver status.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-bold">{selected.title || `Acordo #${selected.id}`}</div>
                  <div className="text-sm text-slate-500">Cliente: {selected.client_nome} • Tel: {selected.client_telefone}</div>
                  <div className="text-sm text-slate-500">Empréstimo: {selected.loan_label || `#${selected.loan_id}`}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button className={`px-3 py-2 rounded-lg ${selected.auto_charge ? 'bg-slate-900 text-white' : 'border'}`} onClick={toggleAutoCharge}>
                    Cobrança WhatsApp: {selected.auto_charge ? 'Ligada' : 'Desligada'}
                  </button>
                  <button className={`px-3 py-2 rounded-lg ${selected.active ? 'bg-emerald-600 text-white' : 'border'}`} onClick={toggleActive}>
                    Acordo: {selected.active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm">Qtd. parcelas</label>
                  <input type="number" min="1" max="240" className="w-full border rounded-lg px-3 py-2" value={count} onChange={e => setCount(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">Valor parcela</label>
                  <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">Primeiro vencimento</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2" value={firstDue} onChange={e => setFirstDue(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <button className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={saveAgreement}>Gerar/Atualizar parcelas</button>
                </div>
              </div>

              <div className="mt-4">
                <div className="font-semibold mb-2">Parcelas</div>
                {!installments.length ? (
                  <div className="text-sm text-slate-500">Nenhuma parcela gerada ainda.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {installments.map(it => {
                      const overdue = it.status !== 'PAID' && it.due_effective < today;
                      return (
                        <div key={it.id} className={`border rounded-xl px-3 py-2 flex items-center justify-between gap-2 ${pillClass(it.status, overdue)}`}>
                          <div className="min-w-0">
                            <div className="font-semibold">Parcela {it.n} • {brl(it.amount)}</div>
                            <div className="text-xs">Venc.: {it.due_effective} • {it.status === 'PAID' ? `Pago em ${it.paid_date}` : (overdue ? 'Vencida' : 'Em aberto')}</div>
                          </div>
                          {it.status === 'PAID' ? (
                            <span className="text-xs px-2 py-1 rounded-lg border bg-white/60">OK</span>
                          ) : (
                            <button className="text-xs px-2 py-1 rounded-lg border bg-white/60" onClick={() => { setPayInst(it); setPayOpen(true); }}>Pagar</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <InstallmentPayModal open={payOpen} onClose={() => setPayOpen(false)} installment={payInst} onPaid={afterPaid} />
    </div>
  );
}
