import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:flex">
      <div className="hidden md:block"><Sidebar /></div>
      {open ? (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85%]"><Sidebar onNavigate={() => setOpen(false)} /></div>
        </div>
      ) : null}
      <main className="flex-1"><Outlet context={{ openMenu: () => setOpen(true) }} /></main>
    </div>
  );
}
