"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  hoy: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1v-7.5Z" />,
  pedidos: <path d="M6 4h12v16l-3-2-3 2-3-2-3 2V4Zm3 5h6m-6 4h6" />,
  productos: <path d="M4 15c0-4 3.6-7 8-7s8 3 8 7H4Zm0 0v3h16v-3M12 8V5" />,
  reparto: <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  ajustes: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" />,
};

export function AdminNav({ newOrders }: { newOrders: number }) {
  const path = usePathname();
  const items = [
    { href: "/admin", label: "Hoy", icon: I.hoy, exact: true },
    { href: "/admin/pedidos", label: "Pedidos", icon: I.pedidos, badge: newOrders },
    { href: "/admin/productos", label: "Productos", icon: I.productos },
    { href: "/admin/reparto", label: "Reparto", icon: I.reparto },
    { href: "/admin/ajustes", label: "Ajustes", icon: I.ajustes },
  ];
  return (
    <nav className="adm-nav" aria-label="Panel">
      {items.map((it) => {
        const active = it.exact ? path === it.href : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {it.icon}
            </svg>
            {it.label}
            {it.badge ? <span className="badge">{it.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
