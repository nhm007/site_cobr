import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import { http } from '../api/http.js';
import { brl } from '../lib/money.js';

function Stat({ label, value }) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-soft">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { openMenu } = useOutletContext();
  const [base, setBase] = useState(null);
  useEffect(() => { http.get('/dashboard').then(setBase); }, []);
  const t = base?.totals || {};
  return (
    <div>
      <Topbar title="Visão Geral" onMenu={openMenu} />
      <div className="p-4 space-y-4 max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Stat label="Clientes" value={t.totalClients ?? 0} />
          <Stat label="Empréstimos (total)" value={t.totalLoans ?? 0} />
          <Stat label="Empréstimos ativos" value={t.totalLoansActive ?? 0} />
          <Stat label="Total emprestado" value={brl(t.totalBorrowed ?? 0)} />
          <Stat label="Total recebido" value={brl(t.totalPaid ?? 0)} />
        </div>
      </div>
    </div>
  );
}
