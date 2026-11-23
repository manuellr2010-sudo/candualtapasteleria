import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lógica pura de Stripe (sin red ni variables de entorno) para poder probarla automáticamente.
 * La usa src/lib/payments/stripe.ts; las pruebas están en tests/stripe.test.ts.
 */

/** Modo según el prefijo de la clave secreta: sk_test_/rk_test_ → prueba; sk_live_/rk_live_ → cobros reales. */
export function stripeKeyMode(key: string): "test" | "live" | null {
  const k = key.trim();
  if (!k) return null;
  if (/^(sk|rk)_live_/.test(k)) return "live";
  if (/^(sk|rk)_test_/.test(k)) return "test";
  return null; // formato desconocido: no se usa
}

/** Verificación oficial de la cabecera "Stripe-Signature" (HMAC-SHA256 de `t.payload`, tolerancia 5 min). */
export function verifyStripeSignatureWith(
  secret: string,
  rawBody: string,
  header: string | null,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !header) return false;
  const parts = header.split(",").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
  });
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

/** Cabecera de firma tal como la genera Stripe (solo para pruebas). */
export function signStripePayload(secret: string, rawBody: string, tSec: number): string {
  const sig = createHmac("sha256", secret).update(`${tSec}.${rawBody}`, "utf8").digest("hex");
  return `t=${tSec},v1=${sig}`;
}

export interface CheckoutOrder {
  id: string;
  number: string;
  items: { title: string; unitCents: number; qty: number }[];
  deliveryFeeCents: number | null;
  locality: string | null;
}

/**
 * Parámetros de la sesión de Stripe Checkout. Importes siempre en céntimos calculados en el servidor
 * (nunca los envía el navegador). No se fuerzan métodos de pago: Stripe muestra los que la cuenta
 * tenga activados (tarjeta, Bizum, PayPal, Apple Pay, Google Pay…).
 */
export function buildCheckoutParams(order: CheckoutOrder, token: string, base: string, nowMs = Date.now()): Record<string, string | number> {
  const params: Record<string, string | number> = {
    mode: "payment",
    locale: "es",
    client_reference_id: order.id,
    "metadata[order_id]": order.id,
    "metadata[order_number]": order.number,
    "payment_intent_data[metadata][order_id]": order.id,
    "payment_intent_data[description]": `Pedido ${order.number} · Candú`,
    success_url: `${base}/pedido/pago?proveedor=stripe&t=${encodeURIComponent(token)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/seguimiento/${encodeURIComponent(token)}?pago=cancelado`,
    // Stripe exige al menos 30 min: la sesión caduca a los 31 y se liberan las unidades reservadas.
    expires_at: Math.floor(nowMs / 1000) + 31 * 60,
  };
  order.items.forEach((it, i) => {
    params[`line_items[${i}][quantity]`] = it.qty;
    params[`line_items[${i}][price_data][currency]`] = "eur";
    params[`line_items[${i}][price_data][unit_amount]`] = it.unitCents;
    params[`line_items[${i}][price_data][product_data][name]`] = it.title.slice(0, 120);
  });
  if (order.deliveryFeeCents) {
    const i = order.items.length;
    params[`line_items[${i}][quantity]`] = 1;
    params[`line_items[${i}][price_data][currency]`] = "eur";
    params[`line_items[${i}][price_data][unit_amount]`] = order.deliveryFeeCents;
    params[`line_items[${i}][price_data][product_data][name]`] = `Entrega en ${order.locality ?? "domicilio"}`;
  }
  return params;
}
