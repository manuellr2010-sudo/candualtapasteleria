import { dateLong, euros } from "./format";
import type { Order, PaymentStatus } from "./types";

/** Textos de los avisos. Solo incluyen lo necesario: sin nombre, teléfono ni dirección del cliente. */
export function paymentStatusLabel(o: Pick<Order, "paymentStatus" | "paymentMethod" | "paymentMode">): string {
  const test = o.paymentMode === "test" ? " (MODO PRUEBA)" : "";
  const map: Record<PaymentStatus, string> = {
    paid: `Pagado${o.paymentMethod === "paypal" ? " con PayPal" : " online"}${test}`,
    pending: `Pago online pendiente${test}`,
    failed: `Pago fallido${test}`,
    expired: "Pago no completado",
    cod_pending: "Pago al recibir o recoger",
    refunded: "Reembolsado",
  };
  return map[o.paymentStatus];
}

export function itemsSummary(o: Pick<Order, "items">): string {
  return o.items.map((i) => `${i.qty}× ${i.title}`).join(", ");
}

export function deliverySummary(o: Pick<Order, "deliveryType" | "locality">): { type: string; place: string } {
  return o.deliveryType === "pickup"
    ? { type: "Recogida en el obrador", place: "Recogida" }
    : { type: "Reparto a domicilio", place: o.locality ?? "" };
}

export function ownerOrderText(o: Order, panelUrl: string): string {
  const d = deliverySummary(o);
  const when = [dateLong(o.requestedDate), o.requestedSlot].filter(Boolean).join(" · ");
  return [
    `Nuevo pedido ${o.number}`,
    `Productos: ${itemsSummary(o)}`,
    `Fecha solicitada: ${when || "sin indicar"}`,
    `Entrega: ${d.type}${o.deliveryType === "delivery" ? ` (${d.place})` : ""}`,
    `Pago: ${paymentStatusLabel(o)} · Total ${euros(o.totalCents)}`,
    `Ver en el panel: ${panelUrl}`,
  ].join("\n");
}

/** Mensaje que el CLIENTE puede enviar a Candú desde su enlace de seguimiento. */
export function customerToOwnerText(o: Order): string {
  const d = deliverySummary(o);
  const when = [dateLong(o.requestedDate), o.requestedSlot].filter(Boolean).join(" · ");
  return [
    `Hola, acabo de hacer el pedido ${o.number} en la web.`,
    `Productos: ${itemsSummary(o)}`,
    `Fecha: ${when || "sin indicar"}`,
    `Entrega: ${d.type}${o.deliveryType === "delivery" ? ` (${d.place})` : ""}`,
    `Pago: ${paymentStatusLabel(o)}`,
  ].join("\n");
}

/** WhatsApp no admite saltos de línea ni tabuladores en los parámetros de plantilla. */
export function templateParam(s: string, max = 900): string {
  return s.replace(/[\n\t]+/g, " · ").replace(/ {4,}/g, "   ").slice(0, max) || "-";
}
