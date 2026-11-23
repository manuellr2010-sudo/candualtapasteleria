import { config, whatsappInboxReady } from "@/lib/env";
import { downloadMedia, verifyMetaSignature } from "@/lib/whatsapp";
import { saveUpload } from "@/lib/storage";
import { attachToWhatsappDraft } from "@/lib/products";
import { logEvent } from "@/lib/log";

/**
 * Webhook oficial de la WhatsApp Cloud API.
 * - GET: verificación inicial que hace Meta al registrar la URL.
 * - POST: mensajes entrantes. Las fotos/vídeos enviados por números autorizados
 *   se guardan (original incluido) y se añaden a un BORRADOR. Nunca se publica nada automáticamente.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("hub.mode");
  const token = u.searchParams.get("hub.verify_token");
  const challenge = u.searchParams.get("hub.challenge") ?? "";
  if (mode === "subscribe" && config.whatsapp.verifyToken && token === config.whatsapp.verifyToken) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Prohibido", { status: 403 });
}

type Msg = { from: string; id: string; type: string; image?: { id: string; caption?: string }; video?: { id: string; caption?: string }; document?: { id: string; caption?: string; mime_type?: string; filename?: string } };

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Firma no válida", { status: 401 });
  if (!whatsappInboxReady()) return new Response("ok");

  let body: { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok");
  }
  const messages = body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];
  for (const m of messages) {
    const media =
      m.type === "image" ? m.image : m.type === "video" ? m.video : m.type === "document" && /^(image|video)\//.test(m.document?.mime_type ?? "") ? m.document : undefined;
    if (!media) continue;
    if (!config.whatsapp.inboxAllowed.includes(m.from)) {
      await logEvent("warn", "whatsapp", `Se ignoró un archivo enviado desde un número no autorizado (…${m.from.slice(-3)}).`);
      continue;
    }
    try {
      const { buf } = await downloadMedia(media.id);
      const saved = await saveUpload(buf, `whatsapp-${m.id}`, "whatsapp");
      await attachToWhatsappDraft(saved.id, media.caption ?? "");
      await logEvent("info", "whatsapp", "Nuevo archivo recibido por WhatsApp y añadido a un borrador. Revísalo antes de publicar.");
    } catch (e) {
      await logEvent("error", "whatsapp", "No se pudo guardar un archivo recibido por WhatsApp. Súbelo a mano desde «Productos › Subir contenido».", String(e));
    }
  }
  return new Response("ok");
}
