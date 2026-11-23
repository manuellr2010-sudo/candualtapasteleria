"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { IconBag, IconClose, IconMenu, IconWhatsapp } from "./Icons";

const LINKS = [
  { href: "/#juani", label: "Juani" },
  { href: "/#temporada", label: "Tienda" },
  { href: "/#obrador", label: "Obrador" },
  { href: "/#contacto", label: "Contacto" },
];

export function Header({ whatsapp, phone }: { whatsapp: string; phone: string }) {
  const pathname = usePathname();
  const overHero = pathname === "/";
  const { count, setOpen, bump } = useCart();
  const [solid, setSolid] = useState(!overHero);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bumping, setBumping] = useState(false);
  const lastY = useRef(0);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setSolid(!overHero || y > window.innerHeight * 0.75);
      setHidden(y > 420 && y > lastY.current + 4);
      if (y < lastY.current - 4) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  useEffect(() => {
    if (!bump) return;
    setBumping(true);
    const t = setTimeout(() => setBumping(false), 520);
    return () => clearTimeout(t);
  }, [bump]);

  useEffect(() => {
    if (!menu) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      menuBtn.current?.focus();
    };
  }, [menu]);

  useEffect(() => setMenu(false), [pathname]);

  return (
    <>
      <header className="site-header" data-over-hero={overHero ? "1" : "0"} data-solid={solid ? "1" : "0"} data-hidden={hidden && !menu ? "1" : "0"}>
        <div className="wrap site-header__row">
          <Link href="/" className="brand" aria-label="Candú Alta Pastelería, inicio">
            <span className="brand__name">Candú</span>
            <span className="brand__tag">Alta Pastelería</span>
          </Link>
          <nav className="nav" aria-label="Principal">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <button id="cart-button" type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={`Abrir cesta, ${count} ${count === 1 ? "producto" : "productos"}`}>
              <IconBag />
              <span className="cart-count" data-bump={bumping ? "1" : "0"} aria-hidden>
                {count}
              </span>
            </button>
            <button ref={menuBtn} type="button" className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Abrir menú" aria-expanded={menu}>
              <IconMenu />
            </button>
          </div>
        </div>
      </header>

      {menu && (
        <div className="mobile-menu on-dark" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="site-header__row">
            <span className="brand">
              <span className="brand__name">Candú</span>
            </span>
            <button type="button" className="icon-btn" onClick={() => setMenu(false)} aria-label="Cerrar menú" autoFocus>
              <IconClose />
            </button>
          </div>
          <nav aria-label="Menú móvil">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenu(false)}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mobile-menu__foot">
            <a className="btn btn--light" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
              <IconWhatsapp /> <span>WhatsApp · {phone}</span>
            </a>
            <span>Las Cucharetas · Cortes de Baza (Granada)</span>
          </div>
        </div>
      )}
    </>
  );
}
