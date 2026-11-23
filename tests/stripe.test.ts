import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCheckoutParams, signStripePayload, stripeKeyMode, verifyStripeSignatureWith } from "../src/lib/payments/stripe-core.ts";

// Secreto inventado para la prueba (no es de ninguna cuenta).
const SECRET = "whsec_prueba_local_no_real";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", livemode: false, data: { object: { id: "cs_test_1", payment_status: "paid" } } });

test("modo de Stripe según el prefijo de la clave", () => {
  assert.equal(stripeKeyMode(""), null);
  assert.equal(stripeKeyMode("sk_test_abc"), "test");
  assert.equal(stripeKeyMode("rk_test_abc"), "test");
  assert.equal(stripeKeyMode("sk_live_abc"), "live");
  assert.equal(stripeKeyMode("pk_test_abc"), null, "una clave publicable no sirve en el servidor");
  assert.equal(stripeKeyMode("cualquier-cosa"), null);
});

test("webhook: acepta una firma válida y reciente", () => {
  const now = 1_800_000_000;
  const header = signStripePayload(SECRET, body, now);
  assert.equal(verifyStripeSignatureWith(SECRET, body, header, 300, now + 10), true);
});

test("webhook: rechaza cuerpo modificado, secreto distinto, firma antigua o cabecera vacía", () => {
  const now = 1_800_000_000;
  const header = signStripePayload(SECRET, body, now);
  assert.equal(verifyStripeSignatureWith(SECRET, body.replace("paid", "unpaid"), header, 300, now), false);
  assert.equal(verifyStripeSignatureWith("whsec_otro", body, header, 300, now), false);
  assert.equal(verifyStripeSignatureWith(SECRET, body, header, 300, now + 301), false, "fuera de la tolerancia de 5 minutos");
  assert.equal(verifyStripeSignatureWith(SECRET, body, null, 300, now), false);
  assert.equal(verifyStripeSignatureWith("", body, header, 300, now), false, "sin secreto configurado no se acepta nada");
  assert.equal(verifyStripeSignatureWith(SECRET, body, "t=abc,v1=00", 300, now), false);
});

test("webhook: admite varias firmas v1 (rotación del secreto en Stripe)", () => {
  const now = 1_800_000_000;
  const good = signStripePayload(SECRET, body, now).split(",")[1];
  const header = `t=${now},v1=${"0".repeat(64)},${good}`;
  assert.equal(verifyStripeSignatureWith(SECRET, body, header, 300, now), true);
});

test("checkout: importes en céntimos desde el servidor, gastos de entrega y referencias del pedido", () => {
  const p = buildCheckoutParams(
    {
      id: "ord_1",
      number: "C-0001",
      items: [
        { title: "Pieza A", unitCents: 2450, qty: 2 },
        { title: "Pieza B", unitCents: 900, qty: 1 },
      ],
      deliveryFeeCents: 300,
      locality: "Baza",
    },
    "token secreto/raro",
    "https://ejemplo.vercel.app",
    1_800_000_000_000,
  );
  assert.equal(p.mode, "payment");
  assert.equal(p.client_reference_id, "ord_1");
  assert.equal(p["metadata[order_id]"], "ord_1");
  assert.equal(p["line_items[0][price_data][unit_amount]"], 2450);
  assert.equal(p["line_items[0][quantity]"], 2);
  assert.equal(p["line_items[1][price_data][unit_amount]"], 900);
  assert.equal(p["line_items[2][price_data][unit_amount]"], 300);
  assert.equal(p["line_items[2][price_data][product_data][name]"], "Entrega en Baza");
  assert.equal(p["line_items[0][price_data][currency]"], "eur");
  // No se fuerzan métodos: Stripe muestra los activados en la cuenta (tarjeta, Bizum, PayPal…).
  assert.ok(!Object.keys(p).some((k) => k.startsWith("payment_method_types")));
  // El token del seguimiento va codificado en las URL de vuelta.
  assert.match(String(p.success_url), /^https:\/\/ejemplo\.vercel\.app\/pedido\/pago\?proveedor=stripe&t=token%20secreto%2Fraro&session_id=\{CHECKOUT_SESSION_ID\}$/);
  assert.equal(p.expires_at, 1_800_000_000 + 31 * 60);
});

test("checkout: sin gastos de entrega no se añade línea extra", () => {
  const p = buildCheckoutParams({ id: "o", number: "C-2", items: [{ title: "X", unitCents: 100, qty: 1 }], deliveryFeeCents: null, locality: null }, "t", "http://localhost:3000");
  assert.equal(p["line_items[1][quantity]"], undefined);
});
