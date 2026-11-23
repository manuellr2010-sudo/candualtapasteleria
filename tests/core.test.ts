import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, slotStart, suggestOrder } from "../src/lib/routing.ts";
import { availability } from "../src/lib/availability.ts";
import { hasPlaceholders, suggestDescription } from "../src/lib/describe.ts";

test("distancia Baza–Cortes de Baza ronda los 18 km en línea recta", () => {
  const km = haversineKm({ lat: 37.4906, lng: -2.7731 }, { lat: 37.6553, lng: -2.7711 });
  assert.ok(km > 17 && km < 20, `obtenido ${km}`);
});

test("slotStart interpreta franjas habituales", () => {
  assert.equal(slotStart("10:00-13:00"), 600);
  assert.equal(slotStart("de 9:30 a 11"), 570);
  assert.equal(slotStart("17h"), 1020);
  assert.equal(slotStart("por la tarde"), null);
});

test("orden sugerido: franja temprana primero, luego cercanía; sin ubicación al final de su franja", () => {
  const origin = { lat: 37.62, lng: -2.78 };
  const s = suggestOrder(origin, [
    { id: "lejos-tarde", point: { lat: 37.49, lng: -2.77 }, approx: true, slot: "17:00-20:00", priority: false },
    { id: "cerca-tarde", point: { lat: 37.6, lng: -2.78 }, approx: true, slot: "17:00-20:00", priority: false },
    { id: "manana", point: { lat: 37.49, lng: -2.77 }, approx: true, slot: "10:00-13:00", priority: false },
    { id: "sin-punto", point: null, approx: true, slot: "10:00-13:00", priority: false },
  ]);
  // Tras la parada de la mañana (en Baza), lo más cercano es la otra parada de Baza.
  assert.deepEqual(s.order, ["manana", "sin-punto", "lejos-tarde", "cerca-tarde"]);
  assert.match(s.reasons["sin-punto"], /sin ubicación/);
  assert.match(s.reasons["manana"], /Franja 10:00-13:00/);
});

test("los prioritarios van primero dentro de su franja", () => {
  const s = suggestOrder({ lat: 0, lng: 0 }, [
    { id: "cerca", point: { lat: 0.01, lng: 0 }, approx: false, slot: "", priority: false },
    { id: "prio", point: { lat: 0.5, lng: 0 }, approx: false, slot: "", priority: true },
  ]);
  assert.deepEqual(s.order, ["prio", "cerca"]);
});

test("la mejora 2-opt no empeora la distancia total del vecino más cercano", () => {
  const pts = [
    { lat: 0, lng: 1 },
    { lat: 0, lng: 3 },
    { lat: 0, lng: 2 },
    { lat: 0, lng: 4 },
  ].map((point, i) => ({ id: `p${i}`, point, approx: false, slot: "", priority: false }));
  const s = suggestOrder({ lat: 0, lng: 0 }, pts);
  assert.deepEqual(s.order, ["p0", "p2", "p1", "p3"]);
});

test("no se puede comprar un producto agotado, cerrado, sin precio o sin publicar", () => {
  const base = { status: "published", soldOut: false, unitsAvailable: null, priceCents: 1000, orderDeadline: null };
  assert.equal(availability(base).buyable, true);
  assert.equal(availability({ ...base, soldOut: true }).buyable, false);
  assert.equal(availability({ ...base, unitsAvailable: 0 }).buyable, false);
  assert.equal(availability({ ...base, priceCents: null }).buyable, false);
  assert.equal(availability({ ...base, orderDeadline: "2000-01-01T00:00:00Z" }).buyable, false);
  assert.equal(availability({ ...base, status: "draft" }).buyable, false);
});

test("la descripción sugerida no inventa: deja huecos que bloquean la publicación", () => {
  const d = suggestDescription({ notes: "tarta de prueba" });
  assert.match(d, /Tarta de prueba\./);
  assert.ok(hasPlaceholders(d));
  assert.doesNotMatch(d, /alérgen|gluten|lactosa|huevo/i);
  assert.ok(hasPlaceholders(suggestDescription({})));
});
