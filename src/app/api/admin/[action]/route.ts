import fs from "node:fs/promises";
import { z } from "zod";
import { assertAdminApi, isAdmin } from "@/lib/auth";
import { INCOMING_PREFIX, LIMITS, originalFile, registerBlobUpload, saveUpload, UploadError } from "@/lib/storage";
import { blobEnabled } from "@/lib/env";
import { createDraft } from "@/lib/products";
import { endRoute, markStop, reorderStops, resuggest, setManualLocality, startRoute, updateLocation } from "@/lib/delivery";
import { getOrder } from "@/lib/orders";
import { locationSchema } from "@/lib/validation";
import { logEvent } from "@/lib/log";
import { nowIso } from "@/lib/db";

type Ctx = { params: Promise<{ action: string }> };

/* ── Descarga del ORIGINAL de un archivo (solo panel) ── */
export async function GET(req: Request, { params }: Ctx) {
  if ((await params).action !== "original") return new Response("No encontrado", { status: 404 });
  if (!(await isAdmin())) return new Response("No autorizado", { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return new Response("No válido", { status: 400 });
  const f = await originalFile(id);
  if (!f) return new Response("No encontrado", { status: 404 });
  // En Vercel Blob: enlace firmado de 5 minutos, solo tras comprobar la sesión del panel.
  if (f.url) return new Response(null, { status: 302, headers: { Location: f.url, "Cache-Control": "private, no-store" } });
  if (!f.file) return new Response("No encontrado", { status: 404 });
  try {
    const data = new Uint8Array(await fs.readFile(f.file));
    const ext = f.file.split(".").pop();
    return new Response(data, {
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `attachment; filename="original-${id}.${ext}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Archivo no disponible", { status: 404 });
  }
}

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const repartoSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("start"), orderIds: z.array(z.string().max(40)).min(1).max(60), sharing: z.boolean(), origin: point.nullable().optional() }),
  z.object({ op: z.literal("location"), routeId: z.string().max(40), lat: locationSchema.shape.lat, lng: locationSchema.shape.lng, accuracy: locationSchema.shape.accuracy }),
  z.object({ op: z.literal("reorder"), routeId: z.string().max(40), orderIds: z.array(z.string().max(40)).max(60) }),
  z.object({ op: z.literal("mark"), routeId: z.string().max(40), orderId: z.string().max(40), status: z.enum(["delivered", "incident", "pending"]), note: z.string().max(300).optional() }),
  z.object({ op: z.literal("manual"), routeId: z.string().max(40), locality: z.string().min(1).max(60) }),
  z.object({ op: z.literal("suggest"), routeId: z.string().max(40), origin: point.nullable().optional() }),
  z.object({ op: z.literal("end"), routeId: z.string().max(40) }),
]);

export async function POST(req: Request, { params }: Ctx) {
  const action = (await params).action;

  // «Compartir» desde la galería o WhatsApp (Android, web instalada): si no hay sesión, se pide entrar.
  if (action === "share") {
    if (!(await isAdmin())) return Response.redirect(new URL("/admin/acceso?compartir=1", req.url), 303);
    const denied = await assertAdminApi(req);
    if (denied) return denied;
    const fd = await req.formData();
    const files = fd.getAll("media").filter((f): f is File => f instanceof File).slice(0, 20);
    const ids: string[] = [];
    for (const f of files) {
      try {
        ids.push((await saveUpload(Buffer.from(await f.arrayBuffer()), f.name, "upload")).id);
      } catch (e) {
        await logEvent("warn", "subidas", `No se pudo guardar un archivo compartido: ${(e as Error).message}`);
      }
    }
    const notes = [fd.get("title"), fd.get("text")].filter(Boolean).join(" ").slice(0, 1000);
    const id = await createDraft({ mediaIds: ids, notes, source: "upload" });
    return Response.redirect(new URL(`/admin/productos/${id}?nuevo=1`, req.url), 303);
  }

  const denied = await assertAdminApi(req);
  if (denied) return denied;

  /* Subida directa del navegador a Vercel Blob (almacén privado): este punto solo emite un permiso temporal
     limitado a fotos/vídeos, tamaño máximo y carpeta incoming/. El archivo se comprueba después en «register». */
  if (action === "blob-token") {
    if (!blobEnabled()) return Response.json({ error: "Almacenamiento en la nube no configurado." }, { status: 400 });
    try {
      const { handleUpload } = await import("@vercel/blob/client");
      const body = await req.json();
      const result = await handleUpload({
        request: req,
        body,
        onBeforeGenerateToken: async (pathname) => {
          if (!pathname.startsWith(INCOMING_PREFIX) || pathname.includes("..")) throw new Error("Ruta no válida");
          return {
            allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif", "video/mp4", "video/quicktime", "video/webm"],
            maximumSizeInBytes: LIMITS.videoBytes,
            addRandomSuffix: true,
            validUntil: Date.now() + 15 * 60_000,
          };
        },
      });
      return Response.json(result);
    } catch (e) {
      await logEvent("warn", "subidas", "No se pudo autorizar una subida a la nube.", String(e));
      return Response.json({ error: "No se pudo preparar la subida." }, { status: 400 });
    }
  }

  if (action === "register") {
    const parsed = z.object({ pathname: z.string().max(260), name: z.string().max(200) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Datos no válidos" }, { status: 400 });
    try {
      const media = await registerBlobUpload(parsed.data.pathname, parsed.data.name);
      return Response.json({ media });
    } catch (e) {
      if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
      await logEvent("error", "subidas", "Fallo al registrar un archivo subido a la nube.", String(e));
      return Response.json({ error: "No se pudo guardar el archivo." }, { status: 500 });
    }
  }

  if (action === "upload") {
    try {
      const fd = await req.formData();
      const file = fd.get("file");
      if (!(file instanceof File)) return Response.json({ error: "No se recibió ningún archivo." }, { status: 400 });
      const media = await saveUpload(Buffer.from(await file.arrayBuffer()), file.name, "upload");
      return Response.json({ media });
    } catch (e) {
      if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
      await logEvent("error", "subidas", "Fallo al guardar un archivo subido.", String(e));
      return Response.json({ error: "No se pudo guardar el archivo." }, { status: 500 });
    }
  }

  if (action === "reparto") {
    const parsed = repartoSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Datos no válidos" }, { status: 400 });
    const d = parsed.data;
    try {
      switch (d.op) {
        case "start": {
          const r = await startRoute(d.orderIds, d.sharing, d.origin ?? null);
          await logEvent("info", "reparto", `Reparto iniciado con ${d.orderIds.length} pedidos${d.sharing ? " y ubicación compartida" : " sin compartir ubicación"}.`);
          return Response.json(r);
        }
        case "location": {
          const ok = await updateLocation(d.routeId, d.lat, d.lng, d.accuracy ?? null);
          if (!ok) return Response.json({ error: "El reparto ya no está activo: la ubicación no se guarda." }, { status: 409 });
          return Response.json({ ok: true, at: nowIso() });
        }
        case "reorder":
          await reorderStops(d.routeId, d.orderIds);
          return Response.json({ ok: true });
        case "mark": {
          if (!(await getOrder(d.orderId))) return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
          await markStop(d.routeId, d.orderId, d.status, d.note ?? "");
          return Response.json({ ok: true });
        }
        case "manual":
          await setManualLocality(d.routeId, d.locality);
          return Response.json({ ok: true });
        case "suggest":
          return Response.json(await resuggest(d.routeId, d.origin ?? null));
        case "end":
          await endRoute(d.routeId);
          await logEvent("info", "reparto", "Reparto terminado: la ubicación dejó de compartirse.");
          return Response.json({ ok: true });
      }
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  return Response.json({ error: "No encontrado" }, { status: 404 });
}
