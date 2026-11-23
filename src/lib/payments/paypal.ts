import "server-only";
import { baseUrl, config, paypalMode } from "../env";
import type { Order } from "../types";

/**
 * PayPal Orders API v2. El pago se confirma con una CAPTURA hecha desde el servidor
 * (respuesta oficial de PayPal) o con un webhook verificado por la propia API de PayPal.
 */
function apiBase() {
  return config.paypal.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function accessToken(): Promise<string> {
  const basic = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(`PayPal: credenciales rechazadas (${data.error_description ?? res.status}).`);
  return data.access_token;
}

async function paypal<T>(path: string, method: "GET" | "POST", body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; name?: string };
  if (!res.ok) throw new Error(`PayPal: ${data.name ?? ""} ${data.message ?? res.status}`.trim());
  return data;
}

const euros = (cents: number) => (cents / 100).toFixed(2);

export async function createPaypalOrder(order: Order, token: string): Promise<{ url: string; paypalOrderId: string }> {
  if (!paypalMode()) throw new Error("PayPal no está configurado.");
  const base = baseUrl();
  const data = await paypal<{ id: string; links: { rel: string; href: string }[] }>(
    "/v2/checkout/orders",
    "POST",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.id,
          custom_id: order.id,
          description: `Pedido ${order.number} · Candú`.slice(0, 127),
          amount: { currency_code: "EUR", value: euros(order.totalCents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Candú Alta Pastelería",
            locale: "es-ES",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${base}/pedido/pago?proveedor=paypal&t=${token}`,
            cancel_url: `${base}/seguimiento/${token}?pago=cancelado`,
          },
        },
      },
    },
    { "PayPal-Request-Id": `candu-${order.id}` },
  );
  const link = data.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) throw new Error("PayPal no devolvió el enlace de pago.");
  return { url: link.href, paypalOrderId: data.id };
}

export interface CaptureResult {
  completed: boolean;
  captureId: string | null;
  amountCents: number;
  customId: string | null;
  status: string;
}

export async function capturePaypalOrder(paypalOrderId: string, orderId: string): Promise<CaptureResult> {
  if (!/^[A-Z0-9]{10,30}$/.test(paypalOrderId)) throw new Error("Pedido de PayPal no válido.");
  type Resp = {
    status: string;
    purchase_units?: { custom_id?: string; payments?: { captures?: { id: string; status: string; amount: { value: string }; custom_id?: string }[] } }[];
  };
  let data: Resp;
  try {
    data = await paypal<Resp>(`/v2/checkout/orders/${paypalOrderId}/capture`, "POST", {}, { "PayPal-Request-Id": `capture-${orderId}` });
  } catch (e) {
    // Si ya se capturó (p. ej. recarga de página), consultamos el estado actual.
    if (String(e).includes("ORDER_ALREADY_CAPTURED") || String(e).includes("UNPROCESSABLE")) {
      data = await paypal<Resp>(`/v2/checkout/orders/${paypalOrderId}`, "GET");
    } else throw e;
  }
  const cap = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    completed: data.status === "COMPLETED" && cap?.status === "COMPLETED",
    captureId: cap?.id ?? null,
    amountCents: cap ? Math.round(parseFloat(cap.amount.value) * 100) : 0,
    customId: cap?.custom_id ?? data.purchase_units?.[0]?.custom_id ?? null,
    status: cap?.status ?? data.status,
  };
}

/** Verificación oficial del webhook mediante /v1/notifications/verify-webhook-signature. */
export async function verifyPaypalWebhook(headers: Headers, event: unknown): Promise<boolean> {
  if (!config.paypal.webhookId || !paypalMode()) return false;
  const h = (k: string) => headers.get(k) ?? "";
  const r = await paypal<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", "POST", {
    auth_algo: h("paypal-auth-algo"),
    cert_url: h("paypal-cert-url"),
    transmission_id: h("paypal-transmission-id"),
    transmission_sig: h("paypal-transmission-sig"),
    transmission_time: h("paypal-transmission-time"),
    webhook_id: config.paypal.webhookId,
    webhook_event: event,
  });
  return r.verification_status === "SUCCESS";
}
