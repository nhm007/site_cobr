import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Layout from './pages/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CadastroClientes from './pages/CadastroClientes.jsx';
import Clientes from './pages/Clientes.jsx';
import Acordos from './pages/Acordos.jsx';
import Calendario from './pages/Calendario.jsx';
import Atrasados from './pages/Atrasados.jsx';
import { getToken } from './api/http.js';

function Private({ children }) {
  const t = getToken();
  return t ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Private><Layout /></Private>}>
        <Route index element={<Dashboard />} />
        <Route path="cadastro" element={<CadastroClientes />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="acordos" element={<Acordos />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="atrasados" element={<Atrasados />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
