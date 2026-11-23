import "server-only";
import { all, newId, nowIso, one, run } from "./db";
import { getMedia } from "./storage";
import { slugify } from "./format";
import { hasPlaceholders, suggestDescription } from "./describe";
import type { Product, ProductStatus } from "./types";
import { isTemplate } from "./templates";

function parseList(v: unknown): string[] {
  try {
    const x = JSON.parse(String(v));
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
}

function rowToProduct(r: Record<string, unknown>): Omit<Product, "media"> {
  let mediaIds: string[] = [];
  try {
    mediaIds = JSON.parse(String(r.media ?? "[]"));
  } catch {
    mediaIds = [];
  }
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    priceCents: r.price_cents === null || r.price_cents === undefined ? null : Number(r.price_cents),
    status: r.status as ProductStatus,
    soldOut: Boolean(Number(r.sold_out)),
    unitsAvailable: r.units_available === null || r.units_available === undefined ? null : Number(r.units_available),
    categoryId: (r.category_id as string | null) ?? null,
    seasonId: (r.season_id as string | null) ?? null,
    orderDeadline: (r.order_deadline as string | null) ?? null,
    deliveryFrom: (r.delivery_from as string | null) ?? null,
    deliveryTo: (r.delivery_to as string | null) ?? null,
    deliveryNote: String(r.delivery_note ?? ""),
    allergenNotes: String(r.allergen_notes ?? ""),
    allergens: r.allergens === null || r.allergens === undefined ? null : parseList(r.allergens),
    template: isTemplate(r.template) ? String(r.template) : "atelier",
    tagline: String(r.tagline ?? ""),
    deliverySlot: String(r.delivery_slot ?? ""),
    mediaIds,
    source: (r.source as Product["source"]) ?? "manual",
    sourceNote: String(r.source_note ?? ""),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

async function hydrate(rows: Record<string, unknown>[]): Promise<Product[]> {
  const base = rows.map(rowToProduct);
  const ids = [...new Set(base.flatMap((p) => p.mediaIds))];
  const media = await getMedia(ids);
  const map = new Map(media.map((m) => [m.id, m]));
  return base.map((p) => ({ ...p, media: p.mediaIds.map((id) => map.get(id)).filter((m) => m !== undefined) }));
}

export async function listProducts(status?: ProductStatus): Promise<Product[]> {
  const rows = status
    ? await all<Record<string, unknown>>(`SELECT * FROM products WHERE status = ? ORDER BY updated_at DESC`, [status])
    : await all<Record<string, unknown>>(`SELECT * FROM products ORDER BY updated_at DESC`);
  return hydrate(rows);
}

/** Productos publicados: primero los comprables, después agotados o cerrados (que no se pueden añadir a la cesta). */
export async function listPublished(): Promise<Product[]> {
  const rows = await all<Record<string, unknown>>(
    `SELECT * FROM products WHERE status = 'published'
     ORDER BY (sold_out = 1 OR (units_available IS NOT NULL AND units_available <= 0)) ASC, published_at DESC`,
  );
  return hydrate(rows);
}

export async function getProduct(id: string): Promise<Product | null> {
  const r = await one<Record<string, unknown>>(`SELECT * FROM products WHERE id = ?`, [id]);
  return r ? (await hydrate([r]))[0] : null;
}

export async function getPublishedBySlug(slug: string): Promise<Product | null> {
  const r = await one<Record<string, unknown>>(`SELECT * FROM products WHERE slug = ? AND status = 'published'`, [slug]);
  return r ? (await hydrate([r]))[0] : null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const rows = await all<Record<string, unknown>>(`SELECT * FROM products WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  return hydrate(rows);
}

export async function createDraft(input: { mediaIds: string[]; notes?: string; source: Product["source"]; title?: string }): Promise<string> {
  const id = newId();
  const now = nowIso();
  await run(
    `INSERT INTO products (id, slug, title, description, status, media, source, source_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    [
      id,
      `borrador-${id.toLowerCase()}`,
      input.title ?? "",
      suggestDescription({ notes: input.notes }),
      JSON.stringify(input.mediaIds),
      input.source,
      (input.notes ?? "").slice(0, 1000),
      now,
      now,
    ],
  );
  return id;
}

/** Añade archivos al borrador de WhatsApp más reciente (últimos 15 min) o crea uno nuevo. */
export async function attachToWhatsappDraft(mediaId: string, caption: string): Promise<string> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const recent = await one<Record<string, unknown>>(
    `SELECT * FROM products WHERE status = 'draft' AND source = 'whatsapp' AND created_at >= ? ORDER BY created_at DESC LIMIT 1`,
    [since],
  );
  if (!recent) return createDraft({ mediaIds: [mediaId], notes: caption, source: "whatsapp" });
  const p = rowToProduct(recent);
  const notes = [p.sourceNote, caption].filter(Boolean).join(" · ");
  await run(`UPDATE products SET media = ?, source_note = ?, updated_at = ? WHERE id = ?`, [
    JSON.stringify([...p.mediaIds, mediaId]),
    notes.slice(0, 1000),
    nowIso(),
    p.id,
  ]);
  return p.id;
}

export interface ProductPatch {
  title: string;
  description: string;
  priceCents: number | null;
  unitsAvailable: number | null;
  categoryId: string | null;
  seasonId: string | null;
  orderDeadline: string | null;
  deliveryFrom: string | null;
  deliveryTo: string | null;
  deliveryNote: string;
  allergenNotes: string;
  allergens: string[] | null;
  template: string;
  tagline: string;
  deliverySlot: string;
  mediaIds: string[];
}

export async function updateProduct(id: string, p: ProductPatch) {
  await run(
    `UPDATE products SET title = ?, description = ?, price_cents = ?, units_available = ?, category_id = ?, season_id = ?,
      order_deadline = ?, delivery_from = ?, delivery_to = ?, delivery_note = ?, allergen_notes = ?, media = ?, updated_at = ?,
      allergens = ?, template = ?, tagline = ?, delivery_slot = ?
     WHERE id = ?`,
    [
      p.title,
      p.description,
      p.priceCents,
      p.unitsAvailable,
      p.categoryId,
      p.seasonId,
      p.orderDeadline,
      p.deliveryFrom,
      p.deliveryTo,
      p.deliveryNote,
      p.allergenNotes,
      JSON.stringify(p.mediaIds),
      nowIso(),
      p.allergens === null ? null : JSON.stringify(p.allergens),
      isTemplate(p.template) ? p.template : "atelier",
      p.tagline,
      p.deliverySlot,
      id,
    ],
  );
}

/** Comprobaciones antes de publicar. Devuelve una lista de problemas en lenguaje claro. */
export function publishProblems(p: Product): string[] {
  const out: string[] = [];
  if (!p.title.trim()) out.push("Escribe un título.");
  if (p.priceCents === null) out.push("Indica el precio.");
  if (!p.description.trim()) out.push("Escribe una descripción.");
  if (hasPlaceholders(p.description)) out.push("La descripción aún tiene huecos [Completa: …]: rellénalos o bórralos.");
  if (!p.media.length) out.push("Añade al menos una foto o vídeo.");
  if (p.media.some((m) => m.needsConversion)) out.push("Hay una foto que no se ha podido convertir (por ejemplo HEIC): quítala o súbela en JPG.");
  if (p.deliveryFrom && p.deliveryTo && p.deliveryTo < p.deliveryFrom) out.push("La fecha final de entrega es anterior a la inicial.");
  return out;
}

async function uniqueSlug(title: string, id: string): Promise<string> {
  const base = slugify(title) || "producto";
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const clash = await one(`SELECT id FROM products WHERE slug = ? AND id != ?`, [slug, id]);
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${id.toLowerCase()}`;
}

export async function publishProduct(id: string): Promise<string[]> {
  const p = await getProduct(id);
  if (!p) return ["El producto no existe."];
  const problems = publishProblems(p);
  if (problems.length) return problems;
  const slug = p.slug.startsWith("borrador-") || p.status !== "published" ? await uniqueSlug(p.title, id) : p.slug;
  const now = nowIso();
  await run(`UPDATE products SET status = 'published', slug = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`, [
    slug,
    now,
    now,
    id,
  ]);
  return [];
}

export async function setStatus(id: string, status: ProductStatus) {
  await run(`UPDATE products SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
}

export async function setSoldOut(id: string, soldOut: boolean) {
  await run(`UPDATE products SET sold_out = ?, updated_at = ? WHERE id = ?`, [soldOut ? 1 : 0, nowIso(), id]);
}

/** Duplica un producto (p. ej. de una temporada anterior) como borrador, sin fechas ni unidades. */
export async function duplicateProduct(id: string): Promise<string | null> {
  const p = await getProduct(id);
  if (!p) return null;
  const nid = newId();
  const now = nowIso();
  await run(
    `INSERT INTO products (id, slug, title, description, price_cents, status, media, category_id, season_id, allergen_notes,
      delivery_note, source, source_note, created_at, updated_at, allergens, template, tagline, delivery_slot)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 'duplicate', ?, ?, ?, ?, ?, ?, ?)`,
    [nid, `borrador-${nid.toLowerCase()}`, p.title, p.description, p.priceCents, JSON.stringify(p.mediaIds), p.categoryId, p.seasonId,
      p.allergenNotes, p.deliveryNote, `Copia de «${p.title}»`, now, now, p.allergens === null ? null : JSON.stringify(p.allergens),
      p.template, p.tagline, p.deliverySlot],
  );
  return nid;
}

export async function deleteDraft(id: string) {
  // Solo borradores; los archivos originales se conservan en la biblioteca.
  await run(`DELETE FROM products WHERE id = ? AND status = 'draft'`, [id]);
}

/** Reserva unidades de forma atómica. Devuelve false si no quedan suficientes. */
export async function reserveUnits(productId: string, qty: number): Promise<boolean> {
  const r = await run(
    `UPDATE products SET units_available = CASE WHEN units_available IS NULL THEN NULL ELSE units_available - ? END
     WHERE id = ? AND (units_available IS NULL OR units_available >= ?)`,
    [qty, productId, qty],
  );
  return r.rowsAffected > 0;
}

export async function releaseUnits(productId: string, qty: number) {
  await run(`UPDATE products SET units_available = units_available + ? WHERE id = ? AND units_available IS NOT NULL`, [qty, productId]);
}
