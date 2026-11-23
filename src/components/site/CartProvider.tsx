"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  image: string | null;
  qty: number;
  max: number | null;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  open: boolean;
  bump: number;
  toast: string | null;
  setOpen: (v: boolean) => void;
  add: (item: Omit<CartItem, "qty">, qty?: number, origin?: HTMLElement | null) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  notify: (msg: string) => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "candu-cart-v1";

export function prefersLessMotion(): boolean {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "reduced" || document.documentElement.dataset.lite === "1";
}

/** Pequeña animación: un punto "vuela" desde el botón hasta la cesta. */
function flyToCart(origin: HTMLElement) {
  if (prefersLessMotion()) return;
  const target = document.getElementById("cart-button");
  if (!target) return;
  const a = origin.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement("div");
  dot.className = "fly-dot";
  dot.style.left = `${a.left + a.width / 2 - 7}px`;
  dot.style.top = `${a.top + a.height / 2 - 7}px`;
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = dot.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(1.3)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0.2 },
    ],
    { duration: 700, easing: "cubic-bezier(.5,0,.3,1)" },
  );
  anim.onfinish = () => dot.remove();
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* almacenamiento no disponible */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* sin almacenamiento: la cesta dura lo que la pestaña */
    }
  }, [items, ready]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const add = useCallback<CartCtx["add"]>(
    (item, qty = 1, origin) => {
      setItems((prev) => {
        const ex = prev.find((i) => i.productId === item.productId);
        const cap = item.max ?? 50;
        if (ex) return prev.map((i) => (i.productId === item.productId ? { ...i, ...item, qty: Math.min(cap, i.qty + qty) } : i));
        return [...prev, { ...item, qty: Math.min(cap, qty) }];
      });
      if (origin) flyToCart(origin);
      setBump((b) => b + 1);
      notify(`«${item.title}» añadido a la cesta`);
    },
    [notify],
  );

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: Math.max(0, Math.min(i.max ?? 50, qty)) } : i))
        .filter((i) => i.qty > 0),
    );
  }, []);

  const remove = useCallback((productId: string) => setItems((prev) => prev.filter((i) => i.productId !== productId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartCtx>(() => {
    const count = items.reduce((a, i) => a + i.qty, 0);
    const subtotal = items.reduce((a, i) => a + i.qty * i.priceCents, 0);
    return { items, count, subtotal, ready, open, bump, toast, setOpen, add, setQty, remove, clear, notify };
  }, [items, ready, open, bump, toast, add, setQty, remove, clear, notify]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fuera de CartProvider");
  return c;
}
