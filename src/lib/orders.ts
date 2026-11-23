import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { all, newId, nowIso, one, run } from "./db";
import { getSettings, type AllSettings } from "./settings";
import { getProductsByIds, releaseUnits, reserveUnits } from "./products";
import { availability } from "./availability";
import { todayMadrid } from "./format";
import { paypalMode, stripeMode } from "./env";
import { logEvent } from "./log";
import type { CheckoutInput } from "./validation";
import type { Order, OrderEvent, OrderItem, OrderStatus, PaymentMethod, PaymentStatus } from "./types";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: String(r.id),
    number: String(r.number),
    status: r.status as OrderStatus,
    customerName: String(r.customer_name),
    customerPhone: String(r.customer_phone),
    deliveryType: r.delivery_type as Order["deliveryType"],
    address: (r.address as string | null) ?? null,
    locality: (r.locality as string | null) ?? null,
    lat: (r.lat as number | null) ?? null,
    lng: (r.lng as number | null) ?? null,
    requestedDate: (r.requested_date as string | null) ?? null,
    requestedSlot: String(r.requested_slot ?? ""),
    notes: String(r.notes ?? ""),
    items: JSON.parse(String(r.items)) as OrderItem[],
    subtotalCents: Number(r.subtotal_cents),
    deliveryFeeCents: r.delivery_fee_cents === null ? null : Number(r.delivery_fee_cents),
    totalCents: Number(r.total_cents),
    paymentMethod: r.payment_method as PaymentMethod,
    paymentStatus: r.payment_status as PaymentStatus,
    paymentRef: (r.payment_ref as string | null) ?? null,
    paymentMode: (r.payment_mode as Order["paymentMode"]) ?? null,
    whatsappConsent: Boolean(Number(r.whatsapp_consent)),
    priority: Boolean(Number(r.priority)),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    statusUpdatedAt: String(r.status_updated_at),
  };
}

/** Métodos de pago que realmente se pueden ofrecer ahora mismo. */
export function availablePaymentMethods(s: AllSettings): { id: PaymentMethod; label: string; note: string; test: boolean }[] {
  const out: { id: PaymentMethod; label: string; note: string; test: boolean }[] = [];
  const sm = stripeMode();
  if (sm) out.push({ id: "stripe", label: s.payments.stripeLabel, note: s.payments.stripeNote, test: sm === "test" });
  const pm = paypalMode();
  if (pm) out.push({ id: "paypal", label: "PayPal", note: "Pagas en la página de PayPal.", test: pm === "test" });
  if (s.payments.codEnabled) out.push({ id: "cod", label: s.payments.codLabel, note: s.payments.codNote, test: false });
  return out;
}

export class OrderError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

function orderNumber(): string {
  const d = todayMadrid().replace(/-/g, "").slice(2);
  const rand = randomBytes(3).readUIntBE(0, 3) % 10000;
  return `CAN-${d}-${String(rand).padStart(4, "0")}`;
}

export async function createOrder(input: CheckoutInput): Promise<{ order: Order; token: string }> {
  const s = await getSettings();
  await expireStalePayments();

  // Agrupa líneas repetidas del mismo producto.
  const qtyById = new Map<string, number>();
  for (const it of input.items) qtyById.set(it.productId, (qtyById.get(it.productId) ?? 0) + it.qty);
  const products = await getProductsByIds([...qtyById.keys()]);
  if (products.length !== qtyById.size) throw new OrderError("Algún producto de tu cesta ya no está disponible. Revisa la cesta.");

  const today = todayMadrid();
  if (input.date < today) throw new OrderError("La fecha elegida ya ha pasado.", "date");

  const items: OrderItem[] = [];
  for (const p of products) {
    const qty = qtyById.get(p.id)!;
    const a = availability(p);
    if (!a.buyable) throw new OrderError(`«${p.title}» ya no se puede pedir (${a.label.toLowerCase()}).`);
    if (a.remaining !== null && qty > a.remaining) throw new OrderError(`Solo quedan ${a.remaining} de «${p.title}».`);
    if (p.deliveryFrom && input.date < p.deliveryFrom)
      throw new OrderError(`«${p.title}» se entrega a partir del ${p.deliveryFrom}.`, "date");
    if (p.deliveryTo && input.date > p.deliveryTo) throw new OrderError(`«${p.title}» se entrega hasta el ${p.deliveryTo}.`, "date");
    items.push({ productId: p.id, title: p.title, unitCents: p.priceCents!, qty });
  }

  let locality: string | null = null;
  let fee: number | null = null;
  let minOrder = s.delivery.minOrderCents;
  if (input.deliveryType === "pickup") {
    if (!s.delivery.pickup.enabled) throw new OrderError("La recogida no está disponible ahora mismo.", "deliveryType");
  } else {
    const loc = s.delivery.localities.find((l) => l.id === input.localityId && l.enabled);
    if (!loc) throw new OrderError("No hacemos reparto a esa localidad por ahora.", "localityId");
    locality = loc.name;
    fee = loc.feeCents;
    if (loc.minOrderCents !== null) minOrder = Math.max(minOrder ?? 0, loc.minOrderCents);
  }
  if (s.delivery.slots.length && !s.delivery.slots.includes(input.slot)) throw new OrderError("Elige una de las franjas disponibles.", "slot");

  const subtotal = items.reduce((acc, i) => acc + i.unitCents * i.qty, 0);
  if (minOrder !== null && subtotal < minOrder) throw new OrderError("El pedido no llega al mínimo indicado.");
  const total = subtotal + (fee ?? 0);

  const method = availablePaymentMethods(s).find((m) => m.id === input.paymentMethod);
  if (!method) throw new OrderError("Ese método de pago no está disponible.", "paymentMethod");

  // Reserva de unidades (atómica por producto). Si algo falla, se deshace.
  const reserved: OrderItem[] = [];
  for (const it of items) {
    if (await reserveUnits(it.productId, it.qty)) reserved.push(it);
    else {
      for (const r of reserved) await releaseUnits(r.productId, r.qty);
      throw new OrderError(`Se acaban de agotar unidades de «${it.title}».`);
    }
  }

  const id = newId();
  const token = randomBytes(24).toString("base64url");
  const now = nowIso();
  const paymentStatus: PaymentStatus = input.paymentMethod === "cod" ? "cod_pending" : "pending";
  const mode = input.paymentMethod === "stripe" ? stripeMode() : input.paymentMethod === "paypal" ? paypalMode() : null;
  let number = orderNumber();
  for (let i = 0; i < 5 && (await one(`SELECT id FROM orders WHERE number = ?`, [number])); i++) number = orderNumber();

  await run(
    `INSERT INTO orders (id, number, token_hash, status, customer_name, customer_phone, delivery_type, address, locality,
      requested_date, requested_slot, notes, items, subtotal_cents, delivery_fee_cents, total_cents, payment_method,
      payment_status, payment_mode, whatsapp_consent, consent_at, created_at, updated_at, status_updated_at)
     VALUES (?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, number, hashToken(token), input.name, input.phone, input.deliveryType,
      input.deliveryType === "delivery" ? input.address : null, locality,
      input.date, input.slot, input.notes, JSON.stringify(items), subtotal, fee, total,
      input.paymentMethod, paymentStatus, mode, input.whatsappConsent ? 1 : 0, input.whatsappConsent ? now : null, now, now, now,
    ],
  );
  await addOrderEvent(id, "created", "Pedido recibido desde la web.");
  return { order: (await getOrder(id))!, token };
}

export async function getOrder(id: string): Promise<Order | null> {
  const r = await one<Record<string, unknown>>(`SELECT * FROM orders WHERE id = ?`, [id]);
  return r ? rowToOrder(r) : null;
}

export async function getOrderByToken(token: string): Promise<Order | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = await one<Record<string, unknown>>(`SELECT * FROM orders WHERE token_hash = ?`, [hashToken(token)]);
  return r ? rowToOrder(r) : null;
}

export async function listOrders(filter: "active" | "today" | "all" | "pending_payment" = "active"): Promise<Order[]> {
  const where =
    filter === "active"
      ? `status NOT IN ('delivered','cancelled') AND payment_status NOT IN ('expired','failed')`
      : filter === "today"
        ? `requested_date = '${todayMadrid()}' AND status != 'cancelled'`
        : filter === "pending_payment"
          ? `payment_status IN ('pending','failed','expired')`
          : "1=1";
  const rows = await all<Record<string, unknown>>(
    `SELECT * FROM orders WHERE ${where} ORDER BY requested_date IS NULL, requested_date ASC, created_at DESC LIMIT 300`,
  );
  return rows.map(rowToOrder);
}

export async function orderEvents(orderId: string): Promise<OrderEvent[]> {
  const rows = await all<Record<string, unknown>>(`SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC`, [orderId]);
  return rows.map((r) => ({ id: String(r.id), orderId, type: String(r.type), message: String(r.message), createdAt: String(r.created_at) }));
}

export async function addOrderEvent(orderId: string, type: string, message: string) {
  await run(`INSERT INTO order_events (id, order_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)`, [newId(), orderId, type, message, nowIso()]);
}

export async function setOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order | null> {
  const before = await getOrder(id);
  if (!before) return null;
  if (before.status === status) return before;
  const now = nowIso();
  await run(`UPDATE orders SET status = ?, updated_at = ?, status_updated_at = ? WHERE id = ?`, [status, now, now, id]);
  const labels = (await getSettings()).statuses;
  await addOrderEvent(id, "status", `Estado: ${labels[status]}${note ? ` · ${note}` : ""}`);
  if (status === "cancelled" && before.status !== "cancelled") await releaseOrderStock(id);
  return getOrder(id);
}

export async function setOrderPriority(id: string, priority: boolean) {
  await run(`UPDATE orders SET priority = ?, updated_at = ? WHERE id = ?`, [priority ? 1 : 0, nowIso(), id]);
}

export async function setOrderCoords(id: string, lat: number | null, lng: number | null) {
  await run(`UPDATE orders SET lat = ?, lng = ? WHERE id = ?`, [lat, lng, id]);
}

export async function setPaymentRef(id: string, ref: string) {
  await run(`UPDATE orders SET payment_ref = ?, updated_at = ? WHERE id = ?`, [ref, nowIso(), id]);
}

/**
 * Marca un pedido como pagado SOLO tras verificarlo con el proveedor (API o webhook firmado).
 * Es idempotente: devuelve true únicamente la primera vez.
 */
export async function markPaid(id: string, ref: string, amountCents: number, provider: string): Promise<boolean> {
  const o = await getOrder(id);
  if (!o) return false;
  if (amountCents !== o.totalCents) {
    await logEvent("error", "pagos", `El importe cobrado por ${provider} no coincide con el pedido ${o.number}. Revísalo antes de prepararlo.`, `esperado=${o.totalCents} recibido=${amountCents}`);
    await addOrderEvent(id, "payment", `⚠️ Importe recibido distinto del total (${amountCents} vs ${o.totalCents} céntimos).`);
    return false;
  }
  const r = await run(
    `UPDATE orders SET payment_status = 'paid', payment_ref = ?, updated_at = ? WHERE id = ? AND payment_status != 'paid'`,
    [ref, nowIso(), id],
  );
  if (r.rowsAffected === 0) return false;
  if (o.paymentStatus === "expired" || o.status === "cancelled") {
    await logEvent("warn", "pagos", `El pedido ${o.number} se pagó después de caducar. Revisa si quedan unidades.`);
    await run(`UPDATE orders SET status = 'received', stock_released = 0 WHERE id = ?`, [id]);
  }
  await addOrderEvent(id, "payment", `Pago verificado con ${provider}.`);
  return true;
}

export async function markPaymentFailed(id: string, reason: string) {
  const o = await getOrder(id);
  if (!o || o.paymentStatus === "paid") return;
  await run(`UPDATE orders SET payment_status = 'failed', updated_at = ? WHERE id = ?`, [nowIso(), id]);
  await addOrderEvent(id, "payment", `Pago no completado: ${reason}`);
}

async function releaseOrderStock(id: string) {
  const o = await getOrder(id);
  if (!o) return;
  const r = await run(`UPDATE orders SET stock_released = 1 WHERE id = ? AND stock_released = 0`, [id]);
  if (r.rowsAffected === 0) return;
  for (const it of o.items) await releaseUnits(it.productId, it.qty);
}

/** Pedidos con pago online sin completar tras 45 min: se cancelan y se liberan sus unidades. */
export async function expireStalePayments() {
  const limit = new Date(Date.now() - 45 * 60_000).toISOString();
  const rows = await all<{ id: string }>(
    `SELECT id FROM orders WHERE payment_status IN ('pending','failed') AND payment_method != 'cod' AND created_at < ? AND status = 'received'`,
    [limit],
  );
  for (const { id } of rows) {
    await run(`UPDATE orders SET payment_status = 'expired', status = 'cancelled', updated_at = ? WHERE id = ?`, [nowIso(), id]);
    await addOrderEvent(id, "payment", "Pago online no completado en 45 minutos: pedido cancelado y unidades liberadas.");
    await releaseOrderStock(id);
  }
}

/** Crea un enlace de seguimiento nuevo (el anterior deja de funcionar). Solo se guarda su hash. */
export async function regenerateTrackingToken(id: string): Promise<string | null> {
  const token = randomBytes(24).toString("base64url");
  const r = await run(`UPDATE orders SET token_hash = ?, updated_at = ? WHERE id = ?`, [hashToken(token), nowIso(), id]);
  if (!r.rowsAffected) return null;
  await addOrderEvent(id, "tracking", "Se generó un enlace de seguimiento nuevo (el anterior ya no funciona).");
  return token;
}

export async function deleteOrderPersonalData(id: string) {
  await run(
    `UPDATE orders SET customer_name = 'Borrado', customer_phone = '', address = NULL, notes = '', lat = NULL, lng = NULL, whatsapp_consent = 0 WHERE id = ?`,
    [id],
  );
  await addOrderEvent(id, "privacy", "Datos personales del cliente borrados.");
}
