import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { blobAccess, blobEnabled, dataDir } from "./env";
import { all, newId, nowIso, one, run } from "./db";
import type { MediaItem } from "./types";

/**
 * Archivos subidos. Se conserva SIEMPRE el original (privado) y se genera una versión web
 * optimizada sin metadatos (p. ej. sin las coordenadas GPS de la foto).
 *
 * Dos destinos posibles:
 *  - Disco local (data/uploads): desarrollo, Docker o VPS.
 *  - Vercel Blob en un almacén PRIVADO (si existe BLOB_READ_WRITE_TOKEN): en Vercel el disco no es persistente.
 *    Nada es accesible por URL directa: la web entrega enlaces firmados de corta duración.
 */
export const LIMITS = { imageBytes: 20 * 1024 * 1024, videoBytes: 120 * 1024 * 1024 };

type Sniffed = { kind: "image" | "video"; mime: string; ext: string } | null;

/** Detecta el tipo real por los primeros bytes; no se confía en el nombre ni en el tipo declarado. */
export function sniff(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "image", mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: "image", mime: "image/png", ext: "png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { kind: "image", mime: "image/webp", ext: "webp" };
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand)) return { kind: "image", mime: "image/heic", ext: "heic" };
    if (["avif", "avis"].includes(brand)) return { kind: "image", mime: "image/avif", ext: "avif" };
    if (brand === "qt  ") return { kind: "video", mime: "video/quicktime", ext: "mov" };
    return { kind: "video", mime: "video/mp4", ext: "mp4" };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { kind: "video", mime: "video/webm", ext: "webm" };
  return null;
}

function dirs() {
  const base = path.join(dataDir(), "uploads");
  return { originals: path.join(base, "originals"), web: path.join(base, "web") };
}

export class UploadError extends Error {}

/* ── Capa de almacenamiento ── */
type Area = "originals" | "web";

async function writeFile(area: Area, name: string, data: Buffer, contentType: string) {
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    await put(`${area}/${name}`, data, { access: blobAccess(), contentType, addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  const dir = dirs()[area];
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(/* turbopackIgnore: true */ dir, name), data);
}

/** Token de lectura firmado, reutilizado mientras sea válido (evita una llamada a la API por cada imagen). */
type G = typeof globalThis & { __canduBlobToken?: { token: { clientSigningToken: string; delegationToken: string }; until: number } };
const g = globalThis as G;

/** URL firmada y temporal para leer un archivo del almacén privado. */
export async function signedBlobUrl(pathname: string, seconds = 3600): Promise<string> {
  const { issueSignedToken, presignUrl } = await import("@vercel/blob");
  const now = Date.now();
  if (!g.__canduBlobToken || g.__canduBlobToken.until - now < 10 * 60_000) {
    const until = now + 2 * 3600_000;
    const t = await issueSignedToken({ pathname: "*", operations: ["get", "head"], validUntil: until });
    g.__canduBlobToken = { token: t, until };
  }
  const validUntil = Math.min(now + seconds * 1000, g.__canduBlobToken.until);
  const { presignedUrl } = await presignUrl(g.__canduBlobToken.token, { operation: "get", pathname, validUntil, access: blobAccess() });
  return presignedUrl;
}

/** Lee los primeros bytes de un archivo ya subido a Blob (para comprobar su tipo real). */
async function readBlobHead(pathname: string, bytes: number): Promise<Buffer> {
  const url = await signedBlobUrl(pathname, 300);
  const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new UploadError("No se encontró el archivo subido.");
  return Buffer.from(await res.arrayBuffer());
}

async function readBlob(pathname: string, maxBytes: number): Promise<Buffer> {
  const url = await signedBlobUrl(pathname, 300);
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new UploadError("No se encontró el archivo subido.");
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new UploadError("El archivo es demasiado grande.");
  return Buffer.from(await res.arrayBuffer());
}

/* ── Procesado ── */
async function processImage(buf: Buffer, id: string) {
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(buf, { failOn: "error" }).rotate();
    const meta = await img.metadata();
    const width = meta.autoOrient?.width ?? meta.width ?? null;
    const height = meta.autoOrient?.height ?? meta.height ?? null;
    // sharp no copia los metadatos (EXIF/GPS) salvo que se pida: la versión web va limpia.
    const web = await img.clone().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const thumb = await img.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
    await writeFile("web", `${id}.webp`, web, "image/webp");
    await writeFile("web", `${id}-t.webp`, thumb, "image/webp");
    return { webPath: `${id}.webp`, thumbPath: `${id}-t.webp`, width, height };
  } catch {
    // Por ejemplo HEIC sin soporte en este servidor: el original queda guardado y se marca para convertir.
    return { webPath: null, thumbPath: null, width: null, height: null };
  }
}

async function insertMedia(m: {
  id: string; kind: "image" | "video"; mime: string; originalPath: string; webPath: string | null; thumbPath: string | null;
  width: number | null; height: number | null; bytes: number; source: MediaItem["source"]; originalName: string;
}): Promise<MediaItem> {
  await run(
    `INSERT INTO media (id, kind, mime, original_path, web_path, thumb_path, width, height, bytes, alt, source, original_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`,
    [m.id, m.kind, m.mime, m.originalPath, m.webPath, m.thumbPath, m.width, m.height, m.bytes, m.source, m.originalName.slice(0, 200), nowIso()],
  );
  return (await getMedia([m.id]))[0];
}

/** Guarda un archivo recibido en memoria (subida pequeña, WhatsApp, compartir en Android). */
export async function saveUpload(buf: Buffer, originalName: string, source: MediaItem["source"]): Promise<MediaItem> {
  const type = sniff(buf);
  if (!type) throw new UploadError("Formato no admitido. Usa fotos JPG, PNG, WEBP o HEIC, o vídeos MP4, MOV o WEBM.");
  if (type.kind === "image" && buf.length > LIMITS.imageBytes) throw new UploadError("La foto supera 20 MB.");
  if (type.kind === "video" && buf.length > LIMITS.videoBytes) throw new UploadError("El vídeo supera 120 MB.");

  const id = newId(9);
  const fileName = `${id}.${type.ext}`;
  await writeFile("originals", fileName, buf, type.mime);

  let r: { webPath: string | null; thumbPath: string | null; width: number | null; height: number | null };
  if (type.kind === "image") r = await processImage(buf, id);
  else {
    await writeFile("web", fileName, buf, type.mime);
    r = { webPath: fileName, thumbPath: null, width: null, height: null };
  }
  return insertMedia({ id, kind: type.kind, mime: type.mime, originalPath: fileName, ...r, bytes: buf.length, source, originalName });
}

/** Prefijo de las subidas directas desde el navegador a Vercel Blob (evita el límite de 4,5 MB de las funciones). */
export const INCOMING_PREFIX = "incoming/";

/**
 * Registra un archivo que el navegador subió directamente al almacén privado de Vercel Blob.
 * Se vuelve a comprobar el tipo real por su contenido antes de aceptarlo.
 */
export async function registerBlobUpload(pathname: string, originalName: string): Promise<MediaItem> {
  if (!blobEnabled()) throw new UploadError("El almacenamiento de archivos en la nube no está configurado.");
  if (!/^incoming\/[A-Za-z0-9._-]{1,200}$/.test(pathname) || pathname.includes("..")) throw new UploadError("Archivo no válido.");
  const { del, copy, head: blobHead } = await import("@vercel/blob");
  const first = await readBlobHead(pathname, 64);
  const type = sniff(first);
  const size = (await blobHead(pathname).catch(() => null))?.size ?? 0;
  const tooBig = type?.kind === "image" ? size > LIMITS.imageBytes : size > LIMITS.videoBytes;
  if (!type || tooBig || size === 0) {
    await del(pathname).catch(() => {});
    throw new UploadError(
      !type ? "Formato no admitido. Usa fotos JPG, PNG, WEBP o HEIC, o vídeos MP4, MOV o WEBM." : type.kind === "image" ? "La foto supera 20 MB." : "El vídeo supera 120 MB.",
    );
  }
  const id = newId(9);
  const originalPath = `${id}.${type.ext}`;
  await copy(pathname, `originals/${originalPath}`, { access: blobAccess(), contentType: type.mime, addRandomSuffix: false, allowOverwrite: true });

  let r: { webPath: string | null; thumbPath: string | null; width: number | null; height: number | null };
  let bytes = 0;
  if (type.kind === "image") {
    const buf = await readBlob(pathname, LIMITS.imageBytes);
    bytes = buf.length;
    r = await processImage(buf, id);
  } else {
    await copy(pathname, `web/${originalPath}`, { access: blobAccess(), contentType: type.mime, addRandomSuffix: false, allowOverwrite: true });
    r = { webPath: originalPath, thumbPath: null, width: null, height: null };
  }
  await del(pathname).catch(() => {});
  return insertMedia({ id, kind: type.kind, mime: type.mime, originalPath, ...r, bytes, source: "upload", originalName });
}

function rowToMedia(r: Record<string, unknown>): MediaItem {
  const web = r.web_path ? `/media/${r.web_path}` : "";
  return {
    id: String(r.id),
    kind: r.kind as MediaItem["kind"],
    mime: String(r.mime),
    url: web,
    thumbUrl: r.thumb_path ? `/media/${r.thumb_path}` : web || null,
    width: (r.width as number | null) ?? null,
    height: (r.height as number | null) ?? null,
    alt: String(r.alt ?? ""),
    source: r.source as MediaItem["source"],
    originalName: String(r.original_name ?? ""),
    createdAt: String(r.created_at),
    needsConversion: !r.web_path,
  };
}

export async function getMedia(ids: string[]): Promise<MediaItem[]> {
  if (!ids.length) return [];
  const rows = await all<Record<string, unknown>>(
    `SELECT * FROM media WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  const map = new Map(rows.map((r) => [String(r.id), rowToMedia(r)]));
  return ids.map((id) => map.get(id)).filter((m): m is MediaItem => Boolean(m));
}

export async function setMediaAlt(id: string, alt: string) {
  await run(`UPDATE media SET alt = ? WHERE id = ?`, [alt.slice(0, 300), id]);
}

/** Original de un archivo (solo para el panel). En Blob devuelve una URL firmada de 5 minutos. */
export async function originalFile(id: string): Promise<{ file?: string; url?: string; mime: string; name: string } | null> {
  const r = await one<Record<string, unknown>>(`SELECT original_path, mime, original_name FROM media WHERE id = ?`, [id]);
  if (!r) return null;
  const base = path.basename(String(r.original_path));
  if (blobEnabled()) return { url: await signedBlobUrl(`originals/${base}`, 300), mime: String(r.mime), name: String(r.original_name) };
  return { file: path.join(dirs().originals, base), mime: String(r.mime), name: String(r.original_name) };
}

const WEB_NAME = /^[A-Za-z0-9_-]+(-t)?\.(webp|mp4|mov|webm)$/;

/** Ruta segura a un archivo web local; evita salir de la carpeta (path traversal). */
export function webFilePath(name: string): string | null {
  if (!WEB_NAME.test(name)) return null;
  return path.join(dirs().web, name);
}

/** URL firmada para una versión web guardada en Blob (null si el nombre no es válido). */
export async function webBlobUrl(name: string): Promise<string | null> {
  if (!WEB_NAME.test(name)) return null;
  return signedBlobUrl(`web/${name}`, 3600);
}
