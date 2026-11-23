"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { euros } from "@/lib/format";
import { useCart } from "./CartProvider";
import { IconArrow, IconClose } from "./Icons";

export function CartDrawer() {
  const { items, open, setOpen, setQty, remove, subtotal, count } = useCart();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" ref={panel} tabIndex={-1}>
        <div className="drawer__head">
          <h2 id="cart-title">
            Tu cesta <span className="muted" style={{ fontSize: "1rem" }}>({count})</span>
          </h2>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar cesta">
            <IconClose />
          </button>
        </div>
        <div className="drawer__body">
          {items.length === 0 ? (
            <div className="drawer__empty">
              <p>Tu cesta está vacía.</p>
              <a className="btn btn--ghost" href="/#temporada" onClick={() => setOpen(false)}>
                <span>Ver lo disponible</span>
              </a>
            </div>
          ) : (
            items.map((i) => (
              <div className="line-item" key={i.productId}>
                {i.image ? <img src={i.image} alt="" /> : <div className="ph" />}
                <div>
                  <h3>{i.title}</h3>
                  <div className="muted" style={{ fontSize: ".9rem" }}>
                    {euros(i.priceCents)} / unidad
                  </div>
                  <div className="line-item__row">
                    <div className="stepper" role="group" aria-label={`Cantidad de ${i.title}`}>
                      <button type="button" onClick={() => setQty(i.productId, i.qty - 1)} aria-label="Quitar una">
                        −
                      </button>
                      <output aria-live="polite">{i.qty}</output>
                      <button type="button" onClick={() => setQty(i.productId, i.qty + 1)} disabled={i.max !== null && i.qty >= i.max} aria-label="Añadir una">
                        +
                      </button>
                    </div>
                    <button type="button" className="remove" onClick={() => remove(i.productId)}>
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="drawer__foot">
            <div className="totals">
              <span>Subtotal</span>
              <strong>{euros(subtotal)}</strong>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              La entrega, la fecha y el pago se eligen en el siguiente paso. Comprobaremos la disponibilidad al confirmar.
            </p>
            <Link href="/pedido" className="btn btn--lg btn--block" onClick={() => setOpen(false)}>
              <span>Tramitar pedido</span> <IconArrow />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
