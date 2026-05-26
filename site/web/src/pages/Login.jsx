import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { http, setToken } from '../api/http.js';

export default function Login() {
  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('admin123');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const r = await http.post('/auth/login', { user, pass }, { auth: false });
      setToken(r.token);
      nav('/');
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border rounded-2xl p-6 shadow-soft">
          <div className="text-2xl font-bold">Entrar</div>
          {err ? <div className="text-red-600 text-sm mt-3">{err}</div> : null}
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <label className="text-sm">Usuário</label>
              <input className="w-full border rounded-lg px-3 py-2" value={user} onChange={e => setUser(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Senha</label>
              <input type="password" className="w-full border rounded-lg px-3 py-2" value={pass} onChange={e => setPass(e.target.value)} />
            </div>
            <button className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Entrar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
