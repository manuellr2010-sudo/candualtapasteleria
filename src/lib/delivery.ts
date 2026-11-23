import "server-only";
import { all, newId, nowIso, one, run } from "./db";
import { config } from "./env";
import { getSettings, type AllSettings } from "./settings";
import { addOrderEvent, getOrder, setOrderCoords, setOrderStatus } from "./orders";
import { notifyCustomerStatus } from "./notify";
import { logEvent } from "./log";
import { haversineKm, suggestOrder, type DistFn, type Pt, type StopInput } from "./routing";
import type { Order, Route, RouteStop } from "./types";

function rowToRoute(r: Record<string, unknown>): Route {
  return {
    id: String(r.id),
    status: r.status as Route["status"],
    sharing: Boolean(Number(r.sharing)),
    startedAt: String(r.started_at),
    endedAt: (r.ended_at as string | null) ?? null,
    lastLat: (r.last_lat as number | null) ?? null,
    lastLng: (r.last_lng as number | null) ?? null,
    lastAccuracy: (r.last_accuracy as number | null) ?? null,
    lastAt: (r.last_at as string | null) ?? null,
    manualLocality: (r.manual_locality as string | null) ?? null,
    manualAt: (r.manual_at as string | null) ?? null,
  };
}

function rowToStop(r: Record<string, unknown>): RouteStop {
  return {
    routeId: String(r.route_id),
    orderId: String(r.order_id),
    position: Number(r.position),
    status: r.status as RouteStop["status"],
    note: String(r.note ?? ""),
    reason: String(r.reason ?? ""),
    updatedAt: String(r.updated_at),
  };
}

/** Pedidos con reparto a domicilio que aún no se han entregado ni están en un reparto activo. */
export async function deliverableOrders(): Promise<Order[]> {
  const rows = await all<{ id: string }>(
    `SELECT o.id FROM orders o
     WHERE o.delivery_type = 'delivery' AND o.status IN ('received','confirmed','preparing','incident')
       AND o.payment_status IN ('paid','cod_pending')
       AND o.id NOT IN (SELECT s.order_id FROM route_stops s JOIN routes r ON r.id = s.route_id WHERE r.status = 'active')
     ORDER BY o.requested_date ASC, o.created_at ASC`,
  );
  const out: Order[] = [];
  for (const r of rows) {
    const o = await getOrder(r.id);
    if (o) out.push(o);
  }
  return out;
}

export async function activeRoute(): Promise<{ route: Route; stops: (RouteStop & { order: Order })[] } | null> {
  await purgeStaleLocations();
  const r = await one<Record<string, unknown>>(`SELECT * FROM routes WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`);
  if (!r) return null;
  const route = rowToRoute(r);
  const stops = (await all<Record<string, unknown>>(`SELECT * FROM route_stops WHERE route_id = ? ORDER BY position ASC`, [route.id])).map(rowToStop);
  const withOrders: (RouteStop & { order: Order })[] = [];
  for (const s of stops) {
    const o = await getOrder(s.orderId);
    if (o) withOrders.push({ ...s, order: o });
  }
  return { route, stops: withOrders };
}

/* ── Geocodificación opcional (Nominatim). Solo si GEOCODER=nominatim. ── */
async function geocode(address: string, locality: string): Promise<Pt | null> {
  if (config.maps.geocoder !== "nominatim") return null;
  try {
    const q = new URLSearchParams({ q: `${address}, ${locality}, Granada, España`, format: "jsonv2", limit: "1", countrycodes: "es" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": "CanduPedidos/1.0 (reparto local)", "Accept-Language": "es" },
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { lat: string; lon: string }[];
    await new Promise((r) => setTimeout(r, 1100)); // política de uso: máximo 1 consulta por segundo
    return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
  } catch (e) {
    await logEvent("warn", "mapas", "No se pudo localizar una dirección; se usa el centro de la localidad.", String(e));
    return null;
  }
}

/* ── Distancias por carretera opcionales (openrouteservice). ── */
async function orsDistFn(points: Pt[]): Promise<DistFn | null> {
  if (!config.maps.orsKey || points.length < 2 || points.length > 50) return null;
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST",
      headers: { Authorization: config.maps.orsKey, "Content-Type": "application/json" },
      body: JSON.stringify({ locations: points.map((p) => [p.lng, p.lat]), metrics: ["duration"] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { durations: (number | null)[][] };
    const key = (p: Pt) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    const idx = new Map(points.map((p, i) => [key(p), i]));
    return (a, b) => {
      const v = data.durations[idx.get(key(a)) ?? -1]?.[idx.get(key(b)) ?? -1];
      return typeof v === "number" ? v / 60 : haversineKm(a, b) * 1.5; // minutos
    };
  } catch (e) {
    await logEvent("warn", "mapas", "openrouteservice no respondió; se usa la distancia en línea recta.", String(e));
    return null;
  }
}

export async function stopPoint(o: Order, s: AllSettings): Promise<{ point: Pt | null; approx: boolean }> {
  if (o.lat !== null && o.lng !== null) return { point: { lat: o.lat, lng: o.lng }, approx: false };
  if (o.address && o.locality) {
    const g = await geocode(o.address, o.locality);
    if (g) {
      await setOrderCoords(o.id, g.lat, g.lng);
      return { point: g, approx: false };
    }
  }
  const loc = s.delivery.localities.find((l) => l.name === o.locality);
  if (loc?.lat != null && loc.lng != null) return { point: { lat: loc.lat, lng: loc.lng }, approx: true };
  return { point: null, approx: true };
}

export async function computeSuggestion(orders: Order[], origin: Pt | null) {
  const s = await getSettings();
  const inputs: StopInput[] = [];
  for (const o of orders) {
    const { point, approx } = await stopPoint(o, s);
    inputs.push({ id: o.id, point, approx, slot: o.requestedSlot, priority: o.priority });
  }
  const start = origin ?? (s.delivery.origin.lat != null && s.delivery.origin.lng != null ? { lat: s.delivery.origin.lat, lng: s.delivery.origin.lng } : null);
  const pts = [start, ...inputs.map((i) => i.point)].filter((p): p is Pt => Boolean(p));
  const ors = await orsDistFn(pts);
  return suggestOrder(start, inputs, ors ?? undefined, ors ? "por carretera" : "en línea recta");
}

export async function startRoute(orderIds: string[], sharing: boolean, origin: Pt | null, trackingUrlFor?: (id: string) => string | undefined) {
  if (await activeRoute()) throw new Error("Ya hay un reparto activo. Termínalo antes de empezar otro.");
  const orders = (await Promise.all(orderIds.map((id) => getOrder(id)))).filter((o): o is Order => Boolean(o));
  if (!orders.length) throw new Error("Elige al menos un pedido para el reparto.");
  const sug = await computeSuggestion(orders, origin);
  const id = newId();
  const now = nowIso();
  await run(`INSERT INTO routes (id, status, sharing, started_at) VALUES (?, 'active', ?, ?)`, [id, sharing ? 1 : 0, now]);
  for (const [i, oid] of sug.order.entries()) {
    await run(`INSERT INTO route_stops (route_id, order_id, position, status, reason, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)`, [
      id,
      oid,
      i,
      sug.reasons[oid] ?? "",
      now,
    ]);
    const o = await setOrderStatus(oid, "out_for_delivery");
    if (o) await notifyCustomerStatus(o, trackingUrlFor?.(oid));
  }
  return { id, totalKm: sug.totalKm };
}

/** Recalcula el orden de las paradas pendientes (las entregadas quedan al principio). */
export async function resuggest(routeId: string, origin: Pt | null) {
  const stops = (await all<Record<string, unknown>>(`SELECT * FROM route_stops WHERE route_id = ? ORDER BY position`, [routeId])).map(rowToStop);
  const done = stops.filter((s) => s.status !== "pending");
  const orders = (await Promise.all(stops.filter((s) => s.status === "pending").map((s) => getOrder(s.orderId)))).filter((o): o is Order => Boolean(o));
  const sug = await computeSuggestion(orders, origin);
  const now = nowIso();
  const ids = [...done.map((s) => s.orderId), ...sug.order];
  for (const [i, oid] of ids.entries()) {
    const reason = sug.reasons[oid];
    await run(`UPDATE route_stops SET position = ?, reason = COALESCE(?, reason), updated_at = ? WHERE route_id = ? AND order_id = ?`, [i, reason ?? null, now, routeId, oid]);
  }
  return { ok: true, totalKm: sug.totalKm };
}

export async function reorderStops(routeId: string, orderIds: string[]) {
  for (const [i, oid] of orderIds.entries()) {
    await run(`UPDATE route_stops SET position = ?, reason = CASE WHEN position != ? THEN 'Orden cambiado a mano' ELSE reason END, updated_at = ? WHERE route_id = ? AND order_id = ?`, [
      i,
      i,
      nowIso(),
      routeId,
      oid,
    ]);
  }
}

export async function markStop(routeId: string, orderId: string, status: "delivered" | "incident" | "pending", note = "") {
  await run(`UPDATE route_stops SET status = ?, note = ?, updated_at = ? WHERE route_id = ? AND order_id = ?`, [status, note.slice(0, 300), nowIso(), routeId, orderId]);
  const o = await setOrderStatus(orderId, status === "delivered" ? "delivered" : status === "incident" ? "incident" : "out_for_delivery", note || undefined);
  if (o) await notifyCustomerStatus(o);
}

/** Guarda SOLO la última posición del reparto (no se guarda el recorrido). */
export async function updateLocation(routeId: string, lat: number, lng: number, accuracy: number | null): Promise<boolean> {
  const r = await run(
    `UPDATE routes SET last_lat = ?, last_lng = ?, last_accuracy = ?, last_at = ?, manual_locality = NULL, manual_at = NULL
     WHERE id = ? AND status = 'active' AND sharing = 1`,
    [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5, accuracy, nowIso(), routeId],
  );
  return r.rowsAffected > 0;
}

export async function setManualLocality(routeId: string, locality: string) {
  await run(`UPDATE routes SET manual_locality = ?, manual_at = ? WHERE id = ? AND status = 'active'`, [locality.slice(0, 60), nowIso(), routeId]);
}

export async function setSharing(routeId: string, sharing: boolean) {
  await run(
    `UPDATE routes SET sharing = ?, last_lat = CASE WHEN ? = 0 THEN NULL ELSE last_lat END, last_lng = CASE WHEN ? = 0 THEN NULL ELSE last_lng END,
       last_at = CASE WHEN ? = 0 THEN NULL ELSE last_at END WHERE id = ? AND status = 'active'`,
    [sharing ? 1 : 0, sharing ? 1 : 0, sharing ? 1 : 0, sharing ? 1 : 0, routeId],
  );
}

/** Termina el reparto: deja de aceptar posiciones y borra la ubicación según la política configurada. */
export async function endRoute(routeId: string, reason = "Reparto terminado") {
  const s = await getSettings();
  const now = nowIso();
  const wipe = s.privacy.locationRetention === "on_end";
  await run(
    `UPDATE routes SET status = 'ended', ended_at = ?, sharing = 0,
       last_lat = CASE WHEN ? THEN NULL ELSE last_lat END, last_lng = CASE WHEN ? THEN NULL ELSE last_lng END,
       last_accuracy = CASE WHEN ? THEN NULL ELSE last_accuracy END, last_at = CASE WHEN ? THEN NULL ELSE last_at END,
       manual_locality = NULL, manual_at = NULL
     WHERE id = ? AND status = 'active'`,
    [now, wipe ? 1 : 0, wipe ? 1 : 0, wipe ? 1 : 0, wipe ? 1 : 0, routeId],
  );
  const pending = await all<{ order_id: string }>(`SELECT order_id FROM route_stops WHERE route_id = ? AND status = 'pending'`, [routeId]);
  for (const p of pending) {
    await setOrderStatus(p.order_id, "preparing");
    await addOrderEvent(p.order_id, "route", `${reason} sin entregar este pedido.`);
  }
}

/**
 * Limpieza de privacidad: cierra repartos abandonados y borra posiciones antiguas.
 * Se ejecuta al consultar repartos y con `npm run privacy:purge`.
 */
export async function purgeStaleLocations() {
  const s = await getSettings();
  const staleLimit = new Date(Date.now() - s.privacy.staleRouteHours * 3600_000).toISOString();
  const stale = await all<{ id: string }>(
    `SELECT id FROM routes WHERE status = 'active' AND COALESCE(last_at, manual_at, started_at) < ?`,
    [staleLimit],
  );
  for (const r of stale) {
    await endRoute(r.id, "Reparto cerrado automáticamente por inactividad");
    await logEvent("info", "reparto", `Un reparto sin actualizaciones durante ${s.privacy.staleRouteHours} h se cerró solo y su ubicación se borró.`);
  }
  const keepLimit = new Date(Date.now() - 24 * 3600_000).toISOString();
  await run(
    `UPDATE routes SET last_lat = NULL, last_lng = NULL, last_accuracy = NULL, last_at = NULL
     WHERE status = 'ended' AND (last_lat IS NOT NULL) AND (? = 'on_end' OR ended_at < ?)`,
    [s.privacy.locationRetention, keepLimit],
  );
}

export interface PublicTracking {
  inRoute: boolean;
  stopsBefore: number;
  sharing: boolean;
  live: { lat: number; lng: number; accuracy: number | null; at: string } | null;
  lastAt: string | null;
  stale: boolean;
  manual: { locality: string; at: string } | null;
}

/** Lo que ve un cliente: solo si SU pedido está pendiente en el reparto activo. */
export async function publicTracking(orderId: string): Promise<PublicTracking | null> {
  const ar = await activeRoute();
  if (!ar) return null;
  const mine = ar.stops.find((s) => s.orderId === orderId);
  if (!mine || mine.status !== "pending") return null;
  const s = await getSettings();
  const pendingBefore = ar.stops.filter((x) => x.position < mine.position && x.status === "pending").length;
  const { route } = ar;
  const fresh =
    route.sharing && route.lastAt && route.lastLat !== null && route.lastLng !== null
      ? Date.now() - new Date(route.lastAt).getTime() <= s.privacy.liveSeconds * 1000
      : false;
  return {
    inRoute: true,
    stopsBefore: pendingBefore,
    sharing: route.sharing,
    live: fresh ? { lat: route.lastLat!, lng: route.lastLng!, accuracy: route.lastAccuracy, at: route.lastAt! } : null,
    lastAt: route.lastAt,
    stale: Boolean(route.sharing && route.lastAt && !fresh),
    manual: route.manualLocality && route.manualAt ? { locality: route.manualLocality, at: route.manualAt } : null,
  };
}
