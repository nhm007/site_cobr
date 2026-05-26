import React from 'react';
import { NavLink } from 'react-router-dom';

const item = 'flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100';
const active = 'bg-slate-200 font-semibold';

export default function Sidebar({ onNavigate }) {
  const linkClass = ({ isActive }) => `${item} ${isActive ? active : ''}`;
  return (
    <aside className="w-72 bg-white border-r min-h-screen p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-slate-900" />
        <div>
          <div className="text-lg font-bold leading-5">Cobranças</div>
          <div className="text-xs text-slate-500">Clientes • Empréstimos • Acordos</div>
        </div>
      </div>
      <nav className="space-y-1">
        <NavLink to="/" end className={linkClass} onClick={onNavigate}>Visão Geral</NavLink>
        <NavLink to="/cadastro" className={linkClass} onClick={onNavigate}>Cadastro</NavLink>
        <NavLink to="/clientes" className={linkClass} onClick={onNavigate}>Clientes</NavLink>
        <NavLink to="/acordos" className={linkClass} onClick={onNavigate}>Acordos</NavLink>
        <div className="pt-2 mt-2 border-t text-xs text-slate-500 px-2">Relatórios</div>
        <NavLink to="/calendario" className={linkClass} onClick={onNavigate}>Calendário</NavLink>
        <NavLink to="/atrasados" className={linkClass} onClick={onNavigate}>Atrasados</NavLink>
      </nav>
    </aside>
  );
}
