"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dateShort, euros } from "@/lib/format";
import type { PublicProduct } from "@/lib/public";
import { AddToCart } from "./AddToCart";
import { CakeArt, IconWhatsapp } from "./Icons";

interface Props {
  products: PublicProduct[];
  categories: { id: string; name: string }[];
  seasons: { id: string; name: string }[];
  emptyTitle: string;
  emptyText: string;
  whatsapp: string;
  /** Fotos reales del obrador para el escaparate vacío (no son productos a la venta). */
  showcase?: { src: string; alt: string }[];
}

function meta(p: PublicProduct): string {
  const parts: string[] = [];
  if (p.orderDeadline && p.availability.buyable) parts.push(`Pide antes del ${dateShort(p.orderDeadline)}`);
  if (p.deliveryFrom && p.deliveryTo && p.deliveryFrom !== p.deliveryTo) parts.push(`Entrega del ${dateShort(p.deliveryFrom)} al ${dateShort(p.deliveryTo)}`);
  else if (p.deliveryFrom) parts.push(`Entrega desde el ${dateShort(p.deliveryFrom)}`);
  return parts.join(" · ");
}

export function ProductCard({ p, i }: { p: PublicProduct; i: number }) {
  const a = p.availability;
  return (
    <article className="pcard" style={{ "--i": i } as React.CSSProperties} data-off={a.buyable ? "0" : "1"}>
      <div className="pcard__media" data-tilt>
        <Link href={`/producto/${p.slug}`} className="pcard__hit" tabIndex={-1} aria-hidden="true" />
        {p.image ? (
          <img src={p.image} alt={p.imageAlt} loading="lazy" decoding="async" />
        ) : p.video ? (
          <video src={p.video} muted playsInline preload="metadata" aria-label={p.imageAlt} />
        ) : null}
        {p.image2 && <img className="alt-img" src={p.image2} alt="" loading="lazy" decoding="async" />}
        <div className="pcard__badges">
          <span className={`chip ${a.buyable ? "chip--dark" : "chip--err"}`}>
            {a.buyable && <span className="dot" />}
            {a.label}
          </span>
        </div>
        {a.buyable && (
          <div className="pcard__add">
            <AddToCart product={{ productId: p.id, slug: p.slug, title: p.title, priceCents: p.priceCents!, image: p.image, max: p.unitsAvailable }} />
          </div>
        )}
      </div>
      <div className="pcard__body">
        <h3 className="pcard__title">
          <Link href={`/producto/${p.slug}`}>{p.title}</Link>
        </h3>
        <span className="pcard__price">{euros(p.priceCents)}</span>
        {meta(p) && <span className="pcard__meta">{meta(p)}</span>}
      </div>
    </article>
  );
}

export function Catalog({ products, categories, seasons, emptyTitle, emptyText, whatsapp, showcase = [] }: Props) {
  const [filter, setFilter] = useState("all");

  const usedCats = categories.filter((c) => products.some((p) => p.categoryId === c.id));
  const usedSeasons = seasons.filter((s) => products.some((p) => p.seasonId === s.id));

  const shown = useMemo(() => {
    if (filter === "all") return products;
    const [kind, id] = filter.split(":");
    return products.filter((p) => (kind === "cat" ? p.categoryId === id : p.seasonId === id));
  }, [filter, products]);

  if (!products.length) {
    return (
      <div className="empty-shop" data-reveal>
        <div className="empty-shop__text">
          {showcase.length === 0 && <CakeArt className="empty__art" />}
          <span className="chip">Catálogo de temporada</span>
          <h3>{emptyTitle}</h3>
          <p>{emptyText}</p>
          <div className="empty-shop__ctas">
            <a className="btn btn--cereza" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, ¿qué tenéis disponible esta temporada?")}`} target="_blank" rel="noopener noreferrer">
              <IconWhatsapp /> <span>Preguntar por WhatsApp</span>
            </a>
            <a className="btn btn--ghost" href="#obrador">
              <span>Ver el obrador</span>
            </a>
          </div>
        </div>
        {showcase.length > 0 && (
          <figure className="empty-shop__collage" aria-label="Fotos de trabajos de Candú">
            {showcase.map((g, i) => (
              <img key={g.src} src={g.src} alt={g.alt} loading="lazy" decoding="async" style={{ "--i": i } as React.CSSProperties} />
            ))}
            <figcaption>Trabajos de temporadas anteriores · no están a la venta ahora</figcaption>
          </figure>
        )}
      </div>
    );
  }

  const chips = [
    { key: "all", label: "Todo" },
    ...usedSeasons.map((s) => ({ key: `season:${s.id}`, label: s.name })),
    ...usedCats.map((c) => ({ key: `cat:${c.id}`, label: c.name })),
  ];

  return (
    <>
      {chips.length > 1 && (
        <div className="filters" role="group" aria-label="Filtrar productos">
          {chips.map((c) => (
            <button key={c.key} type="button" className="filter" aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {shown.length} {shown.length === 1 ? "producto" : "productos"}
      </p>
      <div className="grid" key={filter}>
        {shown.map((p, i) => (
          <ProductCard key={p.id} p={p} i={i} />
        ))}
      </div>
    </>
  );
}
