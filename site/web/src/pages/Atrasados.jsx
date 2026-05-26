import React, { useEffect, useState } from 'react';
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

export default function Atrasados() {
  const { openMenu } = useOutletContext();
  const [asOf, setAsOf] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    try {
      const r = await http.get(`/reports/overdue?asOf=${asOf}`);
      setData(r);
    } catch (e) {
      setErr(e.message);
      setData(null);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div>
      <Topbar title="Atrasados" onMenu={openMenu} right={<button className="px-3 py-2 rounded-lg border" onClick={load}>Atualizar</button>} />
      <div className="p-4 max-w-[1400px] mx-auto space-y-3">
        <div className="bg-white border rounded-2xl p-4 shadow-soft flex gap-3 items-end">
          <div>
            <label className="text-sm">Data de referência</label>
            <input type="date" className="border rounded-lg px-3 py-2" value={asOf} onChange={e=>setAsOf(e.target.value)} />
          </div>
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={load}>Consultar</button>
        </div>

        {err ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3">Erro: {err}</div> : null}

        {!data ? <div className="text-slate-500">Carregando...</div> : (
          <div className="bg-white border rounded-2xl p-4 shadow-soft">
            <div className="font-bold">Atrasados: {data.items?.length || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Competência atual: {data.competencia_atual}</div>

            <div className="mt-3 overflow-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Cliente</th>
                    <th>Empréstimo</th>
                    <th>Mensal</th>
                    <th>Meses</th>
                    <th>Total</th>
                    <th>Mais antigo</th>
                    <th>Dias</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(it => (
                    <tr key={it.loan_id} className="border-b">
                      <td className="py-2">
                        <div className="font-semibold">{it.client_nome}</div>
                        <div className="text-xs text-slate-500">{it.telefone}</div>
                      </td>
                      <td>{it.loan_label || `#${it.loan_id}`}</td>
                      <td>{brl(it.juros_mensal)}</td>
                      <td>{it.overdue_count}</td>
                      <td className="font-semibold text-red-700">{brl(it.overdue_total)}</td>
                      <td className="text-xs">{it.oldest_competencia} ({it.oldest_due_effective})</td>
                      <td>{it.atraso_dias}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button className="text-xs px-2 py-1 rounded-lg border" onClick={()=>copyToClipboard(it.mensagem)}>Copiar</button>
                          <a className="text-xs px-2 py-1 rounded-lg bg-emerald-600 text-white" href={waLink(it.telefone_digits, it.mensagem)} target="_blank" rel="noreferrer">WhatsApp</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
