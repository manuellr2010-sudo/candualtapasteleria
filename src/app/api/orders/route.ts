import { checkoutSchema } from "@/lib/validation";
import { createOrder, getOrderByToken, OrderError, expireStalePayments } from "@/lib/orders";
import { startPayment } from "@/lib/checkout";
import { logEvent } from "@/lib/log";
import { ipFromHeaders } from "@/lib/auth";

/* Límite sencillo por IP para evitar envíos masivos (en memoria). */
type G = typeof globalThis & { __canduOrderRate?: Map<string, number[]> };
const g = globalThis as G;
const hits = (g.__canduOrderRate ??= new Map());
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t: number) => now - t < 10 * 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 12;
}

export async function POST(req: Request) {
  const ip = ipFromHeaders(req.headers);
  if (hits.size > 5000) hits.clear(); // evita que el mapa en memoria crezca sin límite
  if (limited(ip)) return Response.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });

  // Reintento de pago desde la página de seguimiento (formulario HTML).
  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data")) {
    const fd = await req.formData();
    const t = String(fd.get("t") ?? "");
    await expireStalePayments();
    const order = await getOrderByToken(t);
    if (!order || order.paymentMethod === "cod" || !["pending", "failed"].includes(order.paymentStatus) || order.status !== "received") {
      return Response.redirect(new URL(order ? `/seguimiento/${t}` : "/", req.url), 303);
    }
    try {
      const url = await startPayment(order, t);
      return Response.redirect(new URL(url, req.url), 303);
    } catch {
      return Response.redirect(new URL(`/seguimiento/${t}?pago=failed`, req.url), 303);
    }
  }

  const json = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return Response.json({ error: "Revisa los campos marcados.", fieldErrors }, { status: 400 });
  }
  try {
    const { order, token } = await createOrder(parsed.data);
    try {
      const redirect = await startPayment(order, token);
      return Response.json({ redirect });
    } catch {
      return Response.json({ redirect: `/seguimiento/${token}?pago=failed` });
    }
  } catch (e) {
    if (e instanceof OrderError) {
      return Response.json({ error: e.message, fieldErrors: e.field ? { [e.field]: e.message } : undefined }, { status: 409 });
    }
    await logEvent("error", "pedidos", "Error inesperado al crear un pedido desde la web.", String(e));
    return Response.json({ error: "No se pudo crear el pedido. Inténtalo de nuevo o escríbenos por WhatsApp." }, { status: 500 });
  }
}
