import Link from "next/link";
import { availability, type Availability } from "@/lib/availability";
import { dateLong, dateTime, euros } from "@/lib/format";
import { allergenNames, isTemplate, type ProductTemplate } from "@/lib/templates";
import { AddToCart } from "./AddToCart";
import { ProductGallery } from "./ProductGallery";
import { IconWhatsapp } from "./Icons";

/** Datos que necesita una ficha (los de un producto real o, en el panel, los de un borrador). */
export interface ProductViewData {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  priceCents: number | null;
  status: string;
  soldOut: boolean;
  unitsAvailable: number | null;
  orderDeadline: string | null;
  deliveryFrom: string | null;
  deliveryTo: string | null;
  deliverySlot: string;
  deliveryNote: string;
  allergens: string[] | null;
  allergenNotes: string;
  template: string;
  media: { id: string; kind: "image" | "video"; url: string; thumbUrl: string | null; alt: string }[];
}

interface Props {
  p: ProductViewData;
  whatsapp: string;
  seasonName?: string;
  categoryName?: string;
  /** Vista previa del panel: no se puede comprar y se marca claramente. */
  preview?: boolean;
  /** Forzar plantilla (catálogo de plantillas del panel). */
  template?: ProductTemplate;
}

/* ── Bloques comunes ── */

function deliveryText(p: ProductViewData): string | null {
  if (p.deliveryFrom && p.deliveryTo && p.deliveryFrom !== p.deliveryTo) return `Del ${dateLong(p.deliveryFrom)} al ${dateLong(p.deliveryTo)}`;
  if (p.deliveryFrom || p.deliveryTo) return dateLong(p.deliveryFrom ?? p.deliveryTo);
  return null;
}

function Facts({ p, a, variant = "list" }: { p: ProductViewData; a: Availability; variant?: "list" | "cards" }) {
  const items: { k: string; v: string; accent?: boolean }[] = [];
  if (p.orderDeadline) items.push({ k: "Pide antes del", v: dateTime(p.orderDeadline), accent: true });
  const d = deliveryText(p);
  if (d) items.push({ k: "Entrega", v: d });
  if (p.deliverySlot) items.push({ k: "Franja", v: p.deliverySlot });
  if (p.deliveryNote) items.push({ k: "Notas de entrega", v: p.deliveryNote });
  if (a.buyable && a.remaining !== null) items.push({ k: "Unidades", v: `Quedan ${a.remaining}` });
  if (!items.length) return null;
  if (variant === "cards")
    return (
      <>
        {items.map((i) => (
          <div key={i.k} className={`tcard ${i.accent ? "tcard--accent" : ""}`}>
            <span className="tcard__k">{i.k}</span>
            <strong className="tcard__v">{i.v}</strong>
          </div>
        ))}
      </>
    );
  return (
    <dl className="pdp__facts">
      {items.map((i) => (
        <div key={i.k}>
          <dt>{i.k}</dt>
          <dd>{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Allergens({ p }: { p: ProductViewData }) {
  const names = p.allergens ? allergenNames(p.allergens) : [];
  return (
    <section className="allergens" aria-label="Alérgenos">
      <h2>Alérgenos</h2>
      {p.allergens === null ? (
        <p>Información de alérgenos pendiente de confirmar. Si tienes alguna alergia o intolerancia, consulta a Candú antes de pedir.</p>
      ) : names.length ? (
        <ul className="allergen-list">
          {names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : (
        <p>Candú indica que esta pieza no contiene ninguno de los 14 alérgenos de declaración obligatoria.</p>
      )}
      {p.allergenNotes.trim() && <p>{p.allergenNotes}</p>}
    </section>
  );
}

function Buy({ p, a, whatsapp, preview }: { p: ProductViewData; a: Availability; whatsapp: string; preview?: boolean }) {
  const img = p.media.find((m) => m.kind === "image");
  if (preview)
    return (
      <button type="button" className="btn btn--lg btn--block" disabled aria-disabled="true">
        <span>{a.buyable ? "Añadir a la cesta (vista previa)" : `${a.label} · no se puede pedir`}</span>
      </button>
    );
  if (a.buyable && p.priceCents !== null)
    return <AddToCart big withQty product={{ productId: p.id, slug: p.slug, title: p.title, priceCents: p.priceCents, image: img?.thumbUrl ?? null, max: p.unitsAvailable }} />;
  return (
    <div className="notice notice--warn">
      Este producto no se puede pedir ahora ({a.label.toLowerCase()}).{" "}
      <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, me interesa «${p.title}». ¿Volverá a estar disponible?`)}`} target="_blank" rel="noopener noreferrer">
        Pregunta por WhatsApp
      </a>
      .
    </div>
  );
}

function Ask({ p, whatsapp }: { p: ProductViewData; whatsapp: string }) {
  return (
    <a className="btn btn--ghost" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, tengo una duda sobre «${p.title}».`)}`} target="_blank" rel="noopener noreferrer">
      <IconWhatsapp /> <span>Preguntar a Candú</span>
    </a>
  );
}

function Chips({ a, seasonName, categoryName }: { a: Availability; seasonName?: string; categoryName?: string }) {
  return (
    <div className="pdp__chips">
      <span className={`chip ${a.buyable ? "chip--ok" : "chip--err"}`}>{a.label}</span>
      {seasonName && <span className="chip">{seasonName}</span>}
      {categoryName && <span className="chip">{categoryName}</span>}
    </div>
  );
}

function Description({ text, lead = false }: { text: string; lead?: boolean }) {
  const parts = text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return (
    <div className={`prose ${lead ? "prose--lead" : ""}`}>
      {parts.map((x, i) => (
        <p key={i}>{x}</p>
      ))}
    </div>
  );
}

function Media({ m, eager = false }: { m: ProductViewData["media"][number]; eager?: boolean }) {
  if (m.kind === "video") return <video src={m.url} controls playsInline preload="metadata" aria-label={m.alt} />;
  return <img src={m.url} alt={m.alt} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

/* ── Plantillas ── */

export function ProductView({ p, whatsapp, seasonName, categoryName, preview, template }: Props) {
  const a = availability(p);
  const tpl: ProductTemplate = template ?? (isTemplate(p.template) ? p.template : "atelier");
  const media = p.media.filter((m) => m.url).map((m) => ({ ...m, alt: m.alt || p.title }));
  const first = media[0];
  const price = p.priceCents === null && preview ? "[Precio]" : euros(p.priceCents);
  const crumbs = (
    <nav className="crumbs" aria-label="Migas de pan">
      <Link href="/#temporada">Tienda</Link> <span aria-hidden>/</span> <span aria-current="page">{p.title || "Sin título"}</span>
    </nav>
  );
  const head = (big = false) => (
    <>
      <Chips a={a} seasonName={seasonName} categoryName={categoryName} />
      <h1 className={big ? "tpl-title tpl-title--xl" : "tpl-title"}>{p.title || "Sin título"}</h1>
      {p.tagline && <p className="tpl-tagline">{p.tagline}</p>}
      <div className="pdp__price">{price}</div>
    </>
  );

  if (tpl === "editorial") {
    return (
      <article className="tpl tpl--editorial">
        <header className="ed-hero">
          {first && <Media m={first} eager />}
          <div className="ed-hero__veil" />
          <div className="wrap ed-hero__text">
            <Chips a={a} seasonName={seasonName} categoryName={categoryName} />
            <h1 className="tpl-title tpl-title--xl">{p.title || "Sin título"}</h1>
            {p.tagline && <p className="tpl-tagline">{p.tagline}</p>}
          </div>
        </header>
        <div className="wrap ed-body">
          <div>
            {crumbs}
            <Description text={p.description} lead />
            {media.length > 1 && (
              <div className="ed-grid">
                {media.slice(1).map((m) => (
                  <figure key={m.id}>
                    <Media m={m} />
                  </figure>
                ))}
              </div>
            )}
          </div>
          <aside className="ed-aside">
            <div className="pdp__price">{price}</div>
            <Facts p={p} a={a} />
            <Buy p={p} a={a} whatsapp={whatsapp} preview={preview} />
            <Allergens p={p} />
            <Ask p={p} whatsapp={whatsapp} />
          </aside>
        </div>
      </article>
    );
  }

  if (tpl === "galeria") {
    return (
      <article className="tpl tpl--galeria">
        <div className="wrap">{crumbs}</div>
        <div className="gal-strip" role="group" aria-label="Fotos y vídeos" tabIndex={0}>
          {media.map((m, i) => (
            <figure key={m.id} className="gal-strip__item">
              <Media m={m} eager={i === 0} />
            </figure>
          ))}
        </div>
        <div className="wrap gal-info">
          <div>{head()}</div>
          <div className="gal-info__body">
            <Description text={p.description} />
            <Facts p={p} a={a} />
            <Allergens p={p} />
          </div>
        </div>
        <div className="gal-buybar">
          <div className="wrap gal-buybar__row">
            <div className="gal-buybar__name">
              <strong>{p.title}</strong> <span>{price}</span>
            </div>
            <Buy p={p} a={a} whatsapp={whatsapp} preview={preview} />
          </div>
        </div>
      </article>
    );
  }

  if (tpl === "minimal") {
    return (
      <article className="tpl tpl--minimal">
        <div className="min-col">
          {crumbs}
          {first && (
            <figure className="min-frame">
              <Media m={first} eager />
            </figure>
          )}
          {head()}
          <Description text={p.description} />
          <Facts p={p} a={a} />
          <Buy p={p} a={a} whatsapp={whatsapp} preview={preview} />
          <Allergens p={p} />
          <Ask p={p} whatsapp={whatsapp} />
        </div>
      </article>
    );
  }

  if (tpl === "temporada") {
    return (
      <article className="tpl tpl--temporada wrap">
        {crumbs}
        <div className="bento">
          {first && (
            <figure className="bento__hero">
              <Media m={first} eager />
            </figure>
          )}
          <div className="tcard tcard--title">{head(true)}</div>
          <Facts p={p} a={a} variant="cards" />
          {media.slice(1, 3).map((m) => (
            <figure key={m.id} className="bento__img">
              <Media m={m} />
            </figure>
          ))}
          <div className="tcard tcard--wide">
            <Description text={p.description} />
          </div>
          <div className="tcard tcard--buy">
            <Buy p={p} a={a} whatsapp={whatsapp} preview={preview} />
            <Ask p={p} whatsapp={whatsapp} />
          </div>
          <div className="tcard tcard--wide">
            <Allergens p={p} />
          </div>
        </div>
      </article>
    );
  }

  // Atelier (por defecto)
  return (
    <article className="tpl tpl--atelier pdp wrap">
      {crumbs}
      <div className="pdp__grid">
        <ProductGallery media={media.map((m) => ({ id: m.id, kind: m.kind, url: m.url, thumb: m.thumbUrl, alt: m.alt }))} />
        <div className="pdp__info">
          {head()}
          <div style={{ marginTop: 20 }}>
            <Description text={p.description} />
          </div>
          <Facts p={p} a={a} />
          <Buy p={p} a={a} whatsapp={whatsapp} preview={preview} />
          <Allergens p={p} />
          <div style={{ marginTop: 18 }}>
            <Ask p={p} whatsapp={whatsapp} />
          </div>
        </div>
      </div>
    </article>
  );
}
