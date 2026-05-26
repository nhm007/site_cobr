import React from 'react';
import { useNavigate } from 'react-router-dom';
import { clearToken } from '../api/http.js';

export default function Topbar({ title, right, onMenu }) {
  const nav = useNavigate();
  return (
    <header className="bg-white/90 backdrop-blur border-b sticky top-0 z-20">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="md:hidden px-2 py-2 rounded-lg border" onClick={onMenu} aria-label="Menu">☰</button>
          <h1 className="text-lg md:text-xl font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {right}
          <button className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800" onClick={() => { clearToken(); nav('/login'); }}>Sair</button>
        </div>
      </div>
    </header>
  );
}
