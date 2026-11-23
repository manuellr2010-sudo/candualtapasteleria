"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDraftAction, duplicateProductAction, productStatusAction, saveProductAction, type SaveResult } from "@/app/admin/actions";
import { euros } from "@/lib/format";
import { parseEuros } from "@/lib/validation";
import { hasPlaceholders } from "@/lib/describe";
import type { MediaItem, Product } from "@/lib/types";
import { ALLERGENS, PRODUCT_TEMPLATES } from "@/lib/templates";
import { Uploader } from "./Uploader";

interface Props {
  product: Product;
  categories: { id: string; name: string }[];
  seasons: { id: string; name: string }[];
}

/** Convierte una fecha ISO a valor de <input type="datetime-local"> en hora de Madrid. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  return parts.replace(" ", "T");
}

export function ProductEditor({ product: p, categories, seasons }: Props) {
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>(p.media);
  const [title, setTitle] = useState(p.title);
  const [price, setPrice] = useState(p.priceCents !== null ? (p.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [description, setDescription] = useState(p.description);
  const [allergens, setAllergens] = useState(p.allergenNotes);
  const [template, setTemplate] = useState(p.template);
  const [allergensConfirmed, setAllergensConfirmed] = useState(p.allergens !== null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();

  const move = (i: number, dir: -1 | 1) =>
    setMedia((m) => {
      const n = [...m];
      const j = i + dir;
      if (j < 0 || j >= n.length) return m;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const submit = (intent: "save" | "publish") => (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form!;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    fd.set("intent", intent);
    fd.set("mediaIds", JSON.stringify(media.map((m) => m.id)));
    start(async () => {
      const r = await saveProductAction(p.id, fd);
      setResult(r);
      router.refresh();
      document.getElementById("save-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const priceCents = parseEuros(price);
  const cover = media.find((m) => m.kind === "image");
  const placeholders = hasPlaceholders(description);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="stack">
      <div className="row" style={{ flexWrap: "wrap" }}>
        <span className={`chip ${p.status === "published" ? "chip--ok" : p.status === "archived" ? "" : "chip--warn"}`}>
          {p.status === "published" ? "Publicado" : p.status === "archived" ? "Archivado" : "Borrador · no visible"}
        </span>
        {p.soldOut && <span className="chip chip--err">Agotado</span>}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>
          <span>{preview ? "Volver a editar" : "Tarjeta en móvil"}</span>
        </button>
        <a className="btn btn--ghost btn--sm" href={`/admin/productos/${p.id}/vista`}>
          <span>Ver la ficha (vista previa)</span>
        </a>
      </div>

      {p.sourceNote && (
        <p className="notice">
          <strong>Notas originales{p.source === "whatsapp" ? " (desde WhatsApp)" : ""}:</strong> {p.sourceNote}
        </p>
      )}

      {preview ? (
        <div className="phone" aria-label="Vista previa en móvil">
          <div className="phone__screen">
            <article className="pcard" style={{ animation: "none" }}>
              <div className="pcard__media">
                {cover && <img src={cover.thumbUrl ?? cover.url} alt="" />}
                <div className="pcard__badges">
                  <span className="chip chip--dark">{p.soldOut ? "Agotado" : "Disponible"}</span>
                </div>
              </div>
              <div className="pcard__body">
                <h3 className="pcard__title">{title || "Sin título"}</h3>
                <span className="pcard__price">{euros(Number.isNaN(priceCents) ? null : priceCents)}</span>
              </div>
            </article>
            <p style={{ whiteSpace: "pre-line", marginTop: 16, fontSize: ".95rem" }}>{description}</p>
            <div className="allergens">
              <h2>Alérgenos</h2>
              <p>{allergensConfirmed ? allergens || "Alérgenos revisados (ver la ficha)." : "Información de alérgenos pendiente de confirmar. Si tienes alguna alergia o intolerancia, consulta a Candú antes de pedir."}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: preview ? "none" : "grid", gap: 16 }}>
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Fotos y vídeos</h2>
          {media.length === 0 && <p className="meta">Aún no hay archivos. Añade al menos una foto para poder publicar.</p>}
          <div className="media-grid">
            {media.map((m, i) => (
              <div className="media-tile" key={m.id} data-cover={i === 0 ? "1" : "0"}>
                {m.kind === "image" ? (
                  m.thumbUrl ? <img src={m.thumbUrl} alt={m.alt} /> : <div className="meta" style={{ padding: 8 }}>Sin vista (HEIC)</div>
                ) : (
                  <video src={m.url} muted playsInline preload="metadata" />
                )}
                {i === 0 && <span className="chip chip--dark cover-tag">Portada</span>}
                <div className="tile-tools">
                  <button type="button" onClick={() => move(i, -1)} aria-label="Mover antes" disabled={i === 0}>
                    ←
                  </button>
                  <button type="button" onClick={() => setMedia((x) => x.filter((y) => y.id !== m.id))} aria-label="Quitar de este producto (el original se conserva)">
                    ✕
                  </button>
                  <button type="button" onClick={() => move(i, 1)} aria-label="Mover después" disabled={i === media.length - 1}>
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
          {media.length > 0 && (
            <details className="fold">
              <summary>Texto alternativo y originales</summary>
              <div className="stack">
                {media.map((m, i) => (
                  <label className="field" key={m.id}>
                    <span>
                      Archivo {i + 1} ·{" "}
                      <a href={`/api/admin/original?id=${m.id}`} target="_blank" rel="noopener">
                        descargar original
                      </a>
                    </span>
                    <input type="hidden" name="altId" value={m.id} />
                    <input className="input" name="alt" defaultValue={m.alt} placeholder="Describe lo que se ve (para personas con lector de pantalla)" maxLength={300} />
                  </label>
                ))}
              </div>
            </details>
          )}
          <Uploader mode="append" onUploaded={(ms) => setMedia((cur) => [...cur, ...ms.map((x) => ({ ...x, mime: "", width: null, height: null, alt: "", source: "upload" as const, originalName: "", createdAt: "" }))])} />
        </section>

        <section className="card stack">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Diseño de la ficha</h2>
            <a className="meta" href={`/admin/plantillas?t=${template}`}>
              Ver ejemplos de las 5 plantillas
            </a>
          </div>
          <div className="tpl-pick" role="radiogroup" aria-label="Plantilla de la ficha">
            {PRODUCT_TEMPLATES.map((t) => (
              <label key={t.id} className="tpl-opt" data-tpl={t.id}>
                <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} />
                <span className="tpl-thumb" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <strong>{t.name}</strong>
                <small>{t.summary}</small>
              </label>
            ))}
          </div>
          <p className="hint" style={{ margin: 0 }}>
            Guarda y pulsa «Ver la ficha» para comprobar cómo queda con tus fotos y textos.
          </p>
        </section>

        <section className="card stack">
          <label className="field">
            <span>Título *</span>
            <input className="input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Nombre del producto" />
          </label>
          <label className="field">
            <span>Frase corta (opcional)</span>
            <input className="input" name="tagline" defaultValue={p.tagline} maxLength={140} placeholder="Aparece bajo el título. Déjalo vacío si no quieres frase." />
          </label>
          <label className="field">
            <span>Descripción *</span>
            <textarea className="textarea" name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={7} maxLength={3000} />
            <span className="hint">
              Borrador sugerido a partir de tus notas. Los huecos <b>[Completa: …]</b> deben rellenarse o borrarse antes de publicar. No se deducen ingredientes ni alérgenos de las fotos.
            </span>
            {placeholders && <span className="field-error">Aún quedan huecos por completar.</span>}
          </label>
          <div className="two" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label className="field">
              <span>Precio (€) *</span>
              <input className="input" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="24,50" />
              {Number.isNaN(priceCents) && <span className="field-error">Precio no válido</span>}
            </label>
            <label className="field">
              <span>Unidades</span>
              <input className="input" name="units" inputMode="numeric" defaultValue={p.unitsAvailable ?? ""} placeholder="Sin límite" />
            </label>
          </div>
          <fieldset className="field allergen-field">
            <legend>Alérgenos</legend>
            <label className="check">
              <input type="checkbox" name="allergensConfirmed" checked={allergensConfirmed} onChange={(e) => setAllergensConfirmed(e.target.checked)} />
              <span>He revisado los alérgenos de esta pieza</span>
            </label>
            {!allergensConfirmed && (
              <span className="hint">Mientras no lo marques, la web dirá que la información está pendiente y pedirá consultar antes de pedir.</span>
            )}
            <div className="allergen-grid" aria-disabled={!allergensConfirmed}>
              {ALLERGENS.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" name="allergen" value={a.id} defaultChecked={p.allergens?.includes(a.id)} disabled={!allergensConfirmed} />
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
            <textarea className="textarea" name="allergenNotes" value={allergens} onChange={(e) => setAllergens(e.target.value)} rows={2} maxLength={1000} placeholder="Notas (opcional): trazas, cómo se elabora…" />
          </fieldset>
        </section>

        <section className="card stack">
          <h2 style={{ margin: 0 }}>Temporada y fechas</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label className="field">
              <span>Categoría</span>
              <select className="select" name="categoryId" defaultValue={p.categoryId ?? ""}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Temporada</span>
              <select className="select" name="seasonId" defaultValue={p.seasonId ?? ""}>
                <option value="">—</option>
                {seasons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!categories.length && !seasons.length && <p className="hint" style={{ margin: 0 }}>Crea categorías y temporadas en Ajustes › Catálogo para usar los filtros de la web.</p>}
          <label className="field">
            <span>Fecha límite para pedir</span>
            <input className="input" type="datetime-local" name="deadline" defaultValue={toLocalInput(p.orderDeadline)} />
          </label>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label className="field">
              <span>Entrega desde</span>
              <input className="input" type="date" name="deliveryFrom" defaultValue={p.deliveryFrom ?? ""} />
            </label>
            <label className="field">
              <span>Entrega hasta</span>
              <input className="input" type="date" name="deliveryTo" defaultValue={p.deliveryTo ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>Franja de entrega (opcional)</span>
            <input className="input" name="deliverySlot" defaultValue={p.deliverySlot} maxLength={120} placeholder="Ej.: sábado por la mañana" />
          </label>
          <label className="field">
            <span>Notas de entrega (cómo se entrega, conservación…)</span>
            <input className="input" name="deliveryNote" defaultValue={p.deliveryNote} maxLength={300} />
          </label>
        </section>

        <section className="card stack">
          <h2 style={{ margin: 0 }}>Más acciones</h2>
          <div className="actions">
            {p.status === "published" && (
              <button type="button" className="btn btn--ghost" onClick={() => start(() => productStatusAction(p.id, p.soldOut ? "available" : "soldout"))}>
                <span>{p.soldOut ? "Marcar disponible" : "Marcar agotado"}</span>
              </button>
            )}
            {p.status === "published" && (
              <button type="button" className="btn btn--ghost" onClick={() => start(() => productStatusAction(p.id, "unpublish"))}>
                <span>Retirar de la web</span>
              </button>
            )}
            {p.status !== "archived" ? (
              <button type="button" className="btn btn--ghost" onClick={() => start(() => productStatusAction(p.id, "archive"))}>
                <span>Archivar</span>
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => start(() => productStatusAction(p.id, "unarchive"))}>
                <span>Recuperar como borrador</span>
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => start(() => duplicateProductAction(p.id))}>
              <span>Duplicar para otra temporada</span>
            </button>
            {p.status === "draft" && (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ color: "var(--err)" }}
                onClick={() => confirm("¿Eliminar este borrador? Las fotos originales se conservan.") && start(() => deleteDraftAction(p.id))}
              >
                <span>Eliminar borrador</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {result && (
        <div id="save-result" className={`notice ${result.ok ? "notice--ok" : "notice--warn"}`} role="status">
          <strong>{result.message}</strong>
          {result.problems && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {result.problems.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="sticky-bar">
        <button type="button" className="btn btn--ghost" onClick={submit("save")} disabled={pending}>
          <span>{p.status === "published" ? "Guardar" : "Guardar borrador"}</span>
        </button>
        {p.status !== "published" && (
          <button type="button" className="btn btn--cereza" onClick={submit("publish")} disabled={pending}>
            <span>{pending ? "…" : "Publicar"}</span>
          </button>
        )}
      </div>
    </form>
  );
}
