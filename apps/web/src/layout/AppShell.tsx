import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clientes', label: 'Clientes' },
  { to: '/prestamos', label: 'Préstamos activos' },
  { to: '/calculadora', label: 'Calculadora' },
  { to: '/whatsapp', label: 'WhatsApp' },
];

/** Barra lateral fija 232px + contenido — layout compartido por las 4 páginas de Admin Web
 * (mockups 1c/2e, spec.md raíz §9: fondo navy #0F172A, acento verde #10B981 en el ítem activo). */
export function AppShell() {
  return (
    <div className="flex h-screen bg-neutral-50 font-body">
      <aside className="flex w-[232px] flex-none flex-col gap-6 bg-brand-ink p-3.5">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-brand-emerald font-display text-sm font-extrabold text-brand-ink">
            m
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-tight text-white">Microcréditos</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-[9px] px-3 py-2.5 text-[13px] font-semibold',
                  isActive ? 'bg-brand-navy text-white' : 'text-neutral-400 hover:bg-white/5',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
