import "server-only";
import { baseUrl } from "./env";
import { getOrder, getOrderByToken, markPaid, markPaymentFailed, setPaymentRef } from "./orders";
import { notifyOwnerNewOrder } from "./notify";
import { logEvent } from "./log";
import { createStripeCheckout, retrieveStripeSession } from "./payments/stripe";
import { capturePaypalOrder, createPaypalOrder } from "./payments/paypal";
import type { Order } from "./types";

/** Tras crear el pedido: devuelve a dónde enviar al cliente. */
export async function startPayment(order: Order, token: string): Promise<string> {
  if (order.paymentMethod === "cod") {
    await notifyOwnerNewOrder(order);
    return `/seguimiento/${token}?nuevo=1`;
  }
  try {
    if (order.paymentMethod === "stripe") {
      const s = await createStripeCheckout(order, token);
      await setPaymentRef(order.id, s.sessionId);
      return s.url;
    }
    const p = await createPaypalOrder(order, token);
    await setPaymentRef(order.id, p.paypalOrderId);
    return p.url;
  } catch (e) {
    await markPaymentFailed(order.id, "no se pudo abrir la página de pago");
    await logEvent("error", "pagos", `No se pudo iniciar el pago del pedido ${order.number}. El cliente vio un aviso para reintentar o contactar.`, String(e));
    throw e;
  }
}

/** Se llama una sola vez por pedido cuando el proveedor confirma el pago. */
async function afterPaid(orderId: string) {
  const o = await getOrder(orderId);
  if (o) await notifyOwnerNewOrder(o);
}

export type VerifyOutcome = "paid" | "pending" | "failed" | "invalid";

/** Retorno desde Stripe: se consulta la sesión a Stripe; la URL por sí sola no prueba nada. */
export async function verifyStripeReturn(token: string, sessionId: string): Promise<VerifyOutcome> {
  const order = await getOrderByToken(token);
  if (!order) return "invalid";
  if (order.paymentStatus === "paid") return "paid";
  if (order.paymentRef && order.paymentRef !== sessionId) return "invalid";
  try {
    const s = await retrieveStripeSession(sessionId);
    if (s.metadata?.order_id !== order.id) return "invalid";
    if (s.payment_status === "paid") {
      if (await markPaid(order.id, s.id, s.amount_total, "Stripe")) await afterPaid(order.id);
      return (await getOrder(order.id))?.paymentStatus === "paid" ? "paid" : "failed";
    }
    if (s.status === "expired") return "failed";
    return "pending"; // p. ej. métodos asíncronos: lo confirmará el webhook
  } catch (e) {
    await logEvent("warn", "pagos", `No se pudo comprobar con Stripe el pago del pedido ${order.number}. El webhook lo confirmará.`, String(e));
    return "pending";
  }
}

/** Retorno desde PayPal: se CAPTURA el pago desde el servidor y se comprueba importe y pedido. */
export async function verifyPaypalReturn(token: string, paypalOrderId: string): Promise<VerifyOutcome> {
  const order = await getOrderByToken(token);
  if (!order) return "invalid";
  if (order.paymentStatus === "paid") return "paid";
  if (order.paymentRef !== paypalOrderId) return "invalid";
  try {
    const c = await capturePaypalOrder(paypalOrderId, order.id);
    if (c.customId && c.customId !== order.id) return "invalid";
    if (c.completed && c.captureId) {
      if (await markPaid(order.id, paypalOrderId, c.amountCents, "PayPal")) await afterPaid(order.id);
      return (await getOrder(order.id))?.paymentStatus === "paid" ? "paid" : "failed";
    }
    if (c.status === "PENDING") return "pending";
    await markPaymentFailed(order.id, `PayPal devolvió el estado ${c.status}`);
    return "failed";
  } catch (e) {
    await logEvent("error", "pagos", `Fallo al confirmar con PayPal el pedido ${order.number}.`, String(e));
    return "pending";
  }
}

/** Para webhooks verificados. */
export async function confirmPaidFromWebhook(orderId: string, ref: string, amountCents: number, provider: string) {
  if (await markPaid(orderId, ref, amountCents, provider)) await afterPaid(orderId);
}

export function trackingUrl(token: string) {
  return `${baseUrl()}/seguimiento/${token}`;
}
