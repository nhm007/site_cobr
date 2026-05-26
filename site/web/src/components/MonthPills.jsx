import React from 'react';

function Pill({ item, onClick, onToggleHide }) {
  const color = item.status === 'PAGO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : item.status === 'ABERTO' ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className={`border rounded-xl px-3 py-2 flex items-center justify-between gap-2 ${color}`}>
      <button className="text-left flex-1" onClick={() => onClick?.(item)}>
        <div className="font-semibold">{item.competencia}</div>
        <div className="text-xs">Venc.: {item.due_effective} • {item.status === 'PAGO' ? 'Pago' : (item.status === 'ABERTO' ? 'Em aberto' : 'A vencer')}</div>
      </button>
      <button className="text-xs px-2 py-1 rounded-lg border bg-white/60" onClick={(e)=>{e.stopPropagation(); onToggleHide?.(item);}}>
        {item.hidden ? 'Mostrar' : 'Ocultar'}
      </button>
    </div>
  );
}

export default function MonthPills({ items, onMonthClick, onToggleHide }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{items.map(it => <Pill key={it.competencia} item={it} onClick={onMonthClick} onToggleHide={onToggleHide} />)}</div>;
}
