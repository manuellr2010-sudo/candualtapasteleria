import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./env";

/**
 * WhatsApp Business Platform · Cloud API (oficial de Meta).
 * - Envío de plantillas aprobadas (avisos de pedido y de estado).
 * - Descarga de fotos/vídeos recibidos en el número conectado (bandeja de borradores).
 * No existe API oficial para leer los Estados de WhatsApp.
 */
const graph = () => `https://graph.facebook.com/${config.whatsapp.graphVersion}`;

export interface SendResult {
  ok: boolean;
  plain: string; // explicación para el panel
  detail?: string;
}

/** Traduce los errores habituales de la API a lenguaje claro. */
export function explainWhatsappError(code: number | undefined, msg: string): string {
  switch (code) {
    case 190:
      return "El token de WhatsApp ha caducado o no es válido. Genera uno nuevo (usuario del sistema) en Meta Business.";
    case 10:
    case 200:
      return "La app de Meta no tiene permiso whatsapp_business_messaging para este número.";
    case 131030:
      return "El número de destino no está en la lista de números de prueba de la app de Meta.";
    case 131026:
      return "WhatsApp no pudo entregar el mensaje: puede que el número no tenga WhatsApp.";
    case 131047:
      return "Han pasado más de 24 h desde el último mensaje: solo se pueden enviar plantillas aprobadas.";
    case 132000:
      return "El número de parámetros no coincide con la plantilla aprobada.";
    case 132001:
      return "La plantilla no existe o no está aprobada en ese idioma.";
    case 131056:
    case 130429:
      return "Se ha alcanzado el límite de envíos de WhatsApp. Se reintentará más tarde.";
    case 133010:
      return "El número de WhatsApp Business no está registrado en la Cloud API.";
    default:
      return `WhatsApp rechazó el envío${code ? ` (código ${code})` : ""}: ${msg}`;
  }
}

export async function sendTemplate(to: string, template: string, params: string[]): Promise<SendResult> {
  const w = config.whatsapp;
  if (!w.token || !w.phoneNumberId || !template) {
    return { ok: false, plain: "WhatsApp no está conectado: el aviso no se ha enviado automáticamente." };
  }
  try {
    const res = await fetch(`${graph()}/${w.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${w.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: w.templateLang },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { code?: number; message?: string }; messages?: { id: string }[] };
    if (!res.ok || data.error) {
      return { ok: false, plain: explainWhatsappError(data.error?.code, data.error?.message ?? `HTTP ${res.status}`), detail: JSON.stringify(data.error ?? {}) };
    }
    return { ok: true, plain: "Aceptado por WhatsApp para su entrega.", detail: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, plain: "No se pudo contactar con WhatsApp (conexión).", detail: String(e) };
  }
}

/** Verifica la firma X-Hub-Signature-256 que Meta añade a cada webhook. */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = config.whatsapp.appSecret;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function downloadMedia(mediaId: string): Promise<{ buf: Buffer; mime: string }> {
  const auth = { Authorization: `Bearer ${config.whatsapp.token}` };
  const meta = await fetch(`${graph()}/${encodeURIComponent(mediaId)}`, { headers: auth, signal: AbortSignal.timeout(15000) });
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number; error?: { code?: number; message?: string } };
  if (!meta.ok || !info.url) throw new Error(explainWhatsappError(info.error?.code, info.error?.message ?? "sin URL"));
  if (info.file_size && info.file_size > 120 * 1024 * 1024) throw new Error("El archivo de WhatsApp es demasiado grande.");
  const url = new URL(info.url);
  if (!url.hostname.endsWith(".fbsbx.com") && !url.hostname.endsWith(".whatsapp.net") && !url.hostname.endsWith(".facebook.com"))
    throw new Error("URL de descarga inesperada.");
  const file = await fetch(url, { headers: auth, signal: AbortSignal.timeout(60000) });
  if (!file.ok) throw new Error(`No se pudo descargar el archivo (HTTP ${file.status}).`);
  return { buf: Buffer.from(await file.arrayBuffer()), mime: info.mime_type ?? "" };
}
