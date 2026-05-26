import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import LoanModal from '../components/LoanModal.jsx';
import MonthPills from '../components/MonthPills.jsx';
import PaymentModal from '../components/PaymentModal.jsx';
import { http } from '../api/http.js';
import { brl } from '../lib/money.js';

export default function Clientes() {
  const { openMenu } = useOutletContext();
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const [client, setClient] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loan, setLoan] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [timelineError, setTimelineError] = useState('');
  const [showHiddenMonths, setShowHiddenMonths] = useState(false);

  const [showQuitados, setShowQuitados] = useState(false);

  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payDefaultComp, setPayDefaultComp] = useState(null);

  async function loadClients() {
    const list = await http.get(`/clients/summary?q=${encodeURIComponent(q)}&showHidden=${showHidden ? 1 : 0}`);
    setRows(list);
  }

  async function loadLoans(clientId) {
    const list = await http.get(`/loans/by-client/${clientId}`);
    setLoans(list);
    return list;
  }

  async function loadTimeline(loanId) {
    setTimelineError('');
    try {
      const tl = await http.get(`/loans/${loanId}/timeline?showHidden=${showHiddenMonths ? 1 : 0}`);
      setTimeline(tl);
    } catch (e) {
      setTimeline(null);
      setTimelineError(e.message || 'Falha ao carregar histórico');
    }
  }

  useEffect(() => { loadClients(); }, []); // eslint-disable-line
  useEffect(() => { const t = setTimeout(loadClients, 250); return () => clearTimeout(t); }, [q, showHidden]); // eslint-disable-line

  useEffect(() => {
    if (!loan) return;
    loadTimeline(loan.id);
  }, [showHiddenMonths]);

  useEffect(() => {
    if (!client) return;
    if (showQuitados) return;
    if (loan && !loan.ativo) {
      const firstActive = loans.find(x => x.ativo);
      if (firstActive) {
        setLoan(firstActive);
        loadTimeline(firstActive.id);
      }
    }
  }, [showQuitados, client, loan, loans]);

  const filtered = useMemo(() => rows, [rows]);
  const filteredLoans = useMemo(() => loans.filter(l => showQuitados || l.ativo), [loans, showQuitados]);

  async function selectClient(c) {
    setClient(c);
    setLoan(null);
    setTimeline(null);
    setTimelineError('');
    const l = await loadLoans(c.id);
    const pick = (showQuitados ? null : l.find(x => x.ativo)) || l[0] || null;
    if (pick) {
      setLoan(pick);
      await loadTimeline(pick.id);
    }
  }

  async function selectLoan(l) {
    setLoan(l);
    await loadTimeline(l.id);
  }

  function openPayForMonth(item) {
    setPayDefaultComp(item?.competencia || null);
    setPayOpen(true);
  }

  async function afterPayment() {
    if (!client || !loan) return;
    await loadClients();
    const l = await loadLoans(client.id);
    const current = l.find(x => x.id === loan.id);
    if (current) await loadTimeline(current.id);
  }

  async function createAgreementForLoan() {
    if (!loan) return;
    const a = await http.post('/agreements/from-loan', { loan_id: loan.id });
    nav(`/acordos?open=${a.id}`);
  }

  async function quitOrReactivateLoan() {
    if (!loan || !client) return;
    if (loan.ativo) {
      if (!confirm('Confirmar quitação deste empréstimo?')) return;
      await http.post(`/loans/${loan.id}/quitacao`, {});
    } else {
      await http.post(`/loans/${loan.id}/reativar`, {});
    }
    const l = await loadLoans(client.id);
    const current = l.find(x => x.id === loan.id) || (l.find(x => x.ativo) || l[0] || null);
    setLoan(current);
    if (current) await loadTimeline(current.id);
    await loadClients();
  }

  async function toggleAutoChargeLoan() {
    if (!loan || !client) return;
    if (!loan.ativo) {
      alert('Reative o empréstimo para poder ligar a cobrança automática.');
      return;
    }
    await http.put(`/loans/${loan.id}`, { cobrar_auto: !loan.cobrar_auto });
    const l = await loadLoans(client.id);
    const updated = l.find(x => x.id === loan.id) || null;
    if (updated) setLoan(updated);
    await loadClients();
  }

  async function toggleAutoChargeFromCard(e, itemLoan) {
    e.stopPropagation();
    if (!client) return;
    if (!itemLoan.ativo) {
      alert('Reative o empréstimo para poder ligar a cobrança automática.');
      return;
    }
    await http.put(`/loans/${itemLoan.id}`, { cobrar_auto: !itemLoan.cobrar_auto });
    const l = await loadLoans(client.id);
    const updatedSelected = loan ? l.find(x => x.id === loan.id) : null;
    if (updatedSelected) setLoan(updatedSelected);
    await loadClients();
  }

  async function reactivateAndEnableAutoCharge() {
    if (!loan || !client) return;
    if (loan.ativo) return;
    const ok = confirm('Reativar este empréstimo e LIGAR a cobrança automática agora?');
    if (!ok) return;
    await http.post(`/loans/${loan.id}/reativar`, {});
    await http.put(`/loans/${loan.id}`, { cobrar_auto: true });
    const l = await loadLoans(client.id);
    const updated = l.find(x => x.id === loan.id) || null;
    if (updated) {
      setLoan(updated);
      await loadTimeline(updated.id);
    }
    await loadClients();
  }

  return (
    <div>
      <Topbar title="Clientes (1 pessoa = N empréstimos)" onMenu={openMenu} right={<button className="px-3 py-2 rounded-lg border" onClick={loadClients}>Atualizar</button>} />
      <div className="p-4 max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-white border rounded-2xl shadow-soft overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Buscar por nome/CPF" value={q} onChange={e => setQ(e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} /> Mostrar ocultos</label>
          </div>
          <div className="max-h-[72vh] overflow-auto">
            {filtered.map(c => (
              <button key={c.id} onClick={() => selectClient(c)} className={`w-full text-left p-3 border-b hover:bg-slate-50 ${client?.id === c.id ? 'bg-slate-100' : ''}`}>
                <div className="font-semibold truncate">{c.nome}</div>
                <div className="text-xs text-slate-500 truncate">CPF: {c.cpf} • Tel: {c.telefone}</div>
                <div className="text-xs text-slate-500">Empréstimos ativos: {c.emprestimos_ativos} • Acordos ativos: {c.acordos_ativos}</div>
                <div className="text-xs text-slate-500">Emprestado (ativo): {brl(c.total_emprestado_ativo)} • Mensal: {brl(c.total_juros_mensal_ativo || 0)} • Recebido: {brl(c.total_recebido)}</div>
              </button>
            ))}
            {!filtered.length ? <div className="p-4 text-sm text-slate-500">Nenhum cliente.</div> : null}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border rounded-2xl shadow-soft p-4">
          {!client ? (
            <div className="text-slate-500">Selecione um cliente para gerenciar múltiplos empréstimos.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-bold">{client.nome}</div>
                  <div className="text-sm text-slate-500">CPF: {client.cpf} • Tel: {client.telefone}</div>
                  <div className="text-sm text-slate-500">Endereço: {client.endereco || '-'}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white" onClick={() => setLoanModalOpen(true)}>+ Novo empréstimo</button>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Empréstimos</div>
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showQuitados} onChange={e => setShowQuitados(e.target.checked)} /> Mostrar quitados</label>
                </div>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredLoans.map(l => (
                    <button key={l.id} className={`border rounded-xl p-3 text-left hover:bg-slate-50 ${loan?.id===l.id?'bg-slate-100':''}`} onClick={() => selectLoan(l)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{l.label || `Empréstimo #${l.id}`}</div>
                          <div className="text-xs text-slate-500">Mensal: {brl(l.juros_mensal)} • Emprestado: {brl(l.valor_emprestimo)}</div>
                          <div className="text-xs text-slate-500">Vencimento: dia {l.dia_pagamento}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${l.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{l.ativo?'Ativo':'Quitado'}</span>
                          <label className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg border bg-white/60 ${!l.ativo ? 'opacity-60' : ''}`} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={!!l.cobrar_auto} disabled={!l.ativo} onChange={(e) => toggleAutoChargeFromCard(e, l)} />
                            Auto
                          </label>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {!loan ? null : (
                <>
                  <div className="bg-white border rounded-2xl p-3 mt-4 shadow-soft">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold">Resumo do empréstimo selecionado</div>
                        <div className="text-sm text-slate-600">{loan.label || `Empréstimo #${loan.id}`} • Emprestado: {brl(loan.valor_emprestimo)} • Mensal: {brl(loan.juros_mensal)} • Venc.: dia {loan.dia_pagamento}</div>
                        <div className="mt-2">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={!!loan.cobrar_auto} onChange={toggleAutoChargeLoan} disabled={!loan.ativo} />
                            Cobrança automática: <b>{loan.cobrar_auto ? 'Ligada' : 'Desligada'}</b>
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {loan.ativo ? (
                          <button className="px-3 py-2 rounded-lg bg-red-600 text-white" onClick={quitOrReactivateLoan}>Quitar empréstimo</button>
                        ) : (
                          <>
                            <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white" onClick={quitOrReactivateLoan}>Reativar empréstimo</button>
                            <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={reactivateAndEnableAutoCharge}>Reativar + ligar cobrança</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Histórico (juros mensal)</div>
                      <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showHiddenMonths} onChange={e=>setShowHiddenMonths(e.target.checked)} /> Mostrar meses ocultos</label>
                        <button className="px-3 py-2 rounded-lg bg-blue-600 text-white" onClick={createAgreementForLoan}>+ Acordo</button>
                        <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white" onClick={() => openPayForMonth(null)}>+ Pagamento</button>
                      </div>
                    </div>

                    {timelineError ? (
                      <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3">
                        <div className="font-semibold">Falha ao carregar histórico</div>
                        <div className="text-sm">{timelineError}</div>
                        <button className="mt-2 px-3 py-2 rounded-lg bg-red-600 text-white" onClick={() => loadTimeline(loan.id)}>Tentar novamente</button>
                      </div>
                    ) : (!timeline ? (
                      <div className="text-sm text-slate-500 mt-2">Carregando histórico...</div>
                    ) : (
                      <>
                        <div className="text-sm text-slate-600 mt-2">Em aberto (estimado): <span className="font-bold">{brl(timeline.em_aberto_estimado)}</span></div>
                        <div className="mt-2">
                          <MonthPills
                            items={timeline.items}
                            onMonthClick={(it) => { if (it.status !== 'PAGO') openPayForMonth(it); }}
                            onToggleHide={async (it) => {
                              await http.put(`/loans/${loan.id}/timeline/${it.competencia}`, { hidden: !it.hidden });
                              await loadTimeline(loan.id);
                            }}
                          />
                        </div>
                      </>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <LoanModal open={loanModalOpen} onClose={() => setLoanModalOpen(false)} clientId={client?.id} onCreated={async () => {
        if (!client) return;
        await loadClients();
        const l = await loadLoans(client.id);
        const pick = (showQuitados ? null : l.find(x => x.ativo)) || l[0] || null;
        if (pick) { setLoan(pick); await loadTimeline(pick.id); }
      }} />

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} loanId={loan?.id} defaultCompetencia={payDefaultComp} onCreated={afterPayment} />
    </div>
  );
}
