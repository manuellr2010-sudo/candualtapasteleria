"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";
import { IconCheck, IconPlus } from "./Icons";

export interface CartProduct {
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  image: string | null;
  max: number | null;
}

export function AddToCart({ product, big = false, withQty = false }: { product: CartProduct; big?: boolean; withQty?: boolean }) {
  const { add, items } = useCart();
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const inCart = items.find((i) => i.productId === product.productId)?.qty ?? 0;
  const max = product.max === null ? 50 : Math.max(0, product.max - inCart);

  const onAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    add(product, qty, e.currentTarget);
    setDone(true);
    setTimeout(() => setDone(false), 1400);
    setQty(1);
  };

  return (
    <div className="buy-row" style={withQty ? undefined : { margin: 0 }}>
      {withQty && (
        <div className="stepper" role="group" aria-label="Cantidad">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Menos">
            −
          </button>
          <output aria-live="polite">{qty}</output>
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Más">
            +
          </button>
        </div>
      )}
      <button
        type="button"
        className={`add-btn${big ? " add-btn--big" : ""}`}
        onClick={onAdd}
        data-done={done ? "1" : "0"}
        disabled={max <= 0}
        aria-label={`Añadir ${product.title} a la cesta`}
      >
        {done ? <IconCheck /> : <IconPlus />}
        <span>{max <= 0 ? "Máximo en la cesta" : done ? "Añadido" : "Añadir"}</span>
      </button>
    </div>
  );
}
