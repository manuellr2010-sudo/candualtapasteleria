import "server-only";
import { config, baseUrl, whatsappSendReady } from "./env";
import { all, newId, nowIso, run } from "./db";
import { sendTemplate } from "./whatsapp";
import { deliverySummary, itemsSummary, paymentStatusLabel, templateParam } from "./messages";
import { dateShort } from "./format";
import { logEvent } from "./log";
import { getSettings } from "./settings";
import type { Order, OrderStatus } from "./types";

async function record(orderId: string | null, target: "owner" | "customer", status: "sent" | "failed" | "skipped", detail: string) {
  await run(`INSERT INTO notifications (id, order_id, channel, target, status, detail, created_at) VALUES (?, ?, 'whatsapp', ?, ?, ?, ?)`, [
    newId(),
    orderId,
    target,
    status,
    detail,
    nowIso(),
  ]);
}

/**
 * Aviso de pedido nuevo a Candú. Si WhatsApp no está conectado, se registra como "pendiente manual"
 * y el panel muestra el botón «Abrir WhatsApp» (que NO envía nada por sí solo).
 */
export async function notifyOwnerNewOrder(o: Order) {
  if (!whatsappSendReady()) {
    await record(o.id, "owner", "skipped", "WhatsApp automático no conectado. Aviso disponible con el botón «Abrir WhatsApp».");
    return;
  }
  const d = deliverySummary(o);
  const params = [
    o.number,
    itemsSummary(o),
    [dateShort(o.requestedDate), o.requestedSlot].filter(Boolean).join(" ") || "sin fecha",
    d.place || "-",
    d.type,
    paymentStatusLabel(o),
  ].map((p) => templateParam(p));
  for (const to of config.whatsapp.ownerNumbers) {
    const r = await sendTemplate(to, config.whatsapp.templateNewOrder, params);
    await record(o.id, "owner", r.ok ? "sent" : "failed", r.plain);
    if (!r.ok) await logEvent("error", "whatsapp", `Aviso del pedido ${o.number} no enviado: ${r.plain}`, r.detail ?? "");
  }
}

const CUSTOMER_NOTIFY: OrderStatus[] = ["confirmed", "out_for_delivery", "delivered"];

/** Actualización al cliente: solo con su consentimiento y una plantilla aprobada. */
export async function notifyCustomerStatus(o: Order, trackingUrl?: string) {
  if (!o.whatsappConsent || !CUSTOMER_NOTIFY.includes(o.status)) return;
  const tpl = config.whatsapp.templateOrderStatus;
  if (!config.whatsapp.token || !config.whatsapp.phoneNumberId || !tpl) {
    await record(o.id, "customer", "skipped", "Plantilla de estado no configurada: no se avisó al cliente.");
    return;
  }
  const labels = (await getSettings()).statuses;
  const phone = o.customerPhone.replace(/^\+|^00/, "");
  const to = phone.startsWith("34") && phone.length === 11 ? phone : `34${phone}`;
  const r = await sendTemplate(to, tpl, [o.number, labels[o.status], trackingUrl ?? baseUrl()].map((p) => templateParam(p)));
  await record(o.id, "customer", r.ok ? "sent" : "failed", r.plain);
  if (!r.ok) await logEvent("warn", "whatsapp", `No se pudo avisar al cliente del pedido ${o.number}: ${r.plain}`, r.detail ?? "");
}

export async function orderNotifications(orderId: string) {
  return all<{ target: string; status: string; detail: string; created_at: string }>(
    `SELECT target, status, detail, created_at FROM notifications WHERE order_id = ? ORDER BY created_at DESC`,
    [orderId],
  );
}
