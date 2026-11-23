import "server-only";
import { baseUrl, config, stripeMode } from "../env";
import { buildCheckoutParams, verifyStripeSignatureWith } from "./stripe-core";
import type { Order } from "../types";

/**
 * Stripe Checkout (página de pago alojada por Stripe).
 * Los métodos (tarjeta, Bizum, PayPal, Apple Pay, Google Pay…) se activan en el panel de Stripe;
 * no se fuerza ninguno aquí para que Stripe muestre solo los que la cuenta tiene habilitados.
 */
const API = "https://api.stripe.com/v1";

function form(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripe<T>(path: string, method: "GET" | "POST", params?: Record<string, string | number>): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.stripe.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? form(params) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json()) as T & { error?: { message?: string; code?: string } };
  if (!res.ok || data.error) throw new Error(`Stripe: ${data.error?.message ?? res.status}`);
  return data;
}

export interface StripeSession {
  id: string;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  amount_total: number;
  currency: string;
  client_reference_id: string | null;
  metadata: Record<string, string>;
  payment_intent: string | null;
}

export async function createStripeCheckout(order: Order, token: string): Promise<{ url: string; sessionId: string }> {
  if (!stripeMode()) throw new Error("Stripe no está configurado.");
  const params = buildCheckoutParams(order, token, baseUrl());
  const s = await stripe<StripeSession>("/checkout/sessions", "POST", params);
  if (!s.url) throw new Error("Stripe no devolvió la página de pago.");
  return { url: s.url, sessionId: s.id };
}

export async function retrieveStripeSession(id: string): Promise<StripeSession> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new Error("Sesión de Stripe no válida.");
  return stripe<StripeSession>(`/checkout/sessions/${id}`, "GET");
}

/** Verificación oficial de la firma "Stripe-Signature" (HMAC-SHA256, tolerancia 5 min). */
export function verifyStripeSignature(rawBody: string, header: string | null, toleranceSec = 300): boolean {
  return verifyStripeSignatureWith(config.stripe.webhookSecret, rawBody, header, toleranceSec);
}
