import { verifyStripeSignature } from "@/lib/payments/stripe";
import { verifyPaypalWebhook } from "@/lib/payments/paypal";
import { confirmPaidFromWebhook } from "@/lib/checkout";
import { markPaymentFailed } from "@/lib/orders";
import { logEvent } from "@/lib/log";
import { stripeMode } from "@/lib/env";

/**
 * Webhooks de pago: única vía (junto con la verificación en servidor al volver) para marcar pagado.
 * URLs a configurar en cada proveedor: /api/payments/stripe y /api/payments/paypal
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider;
  const raw = await req.text();

  if (provider === "stripe") {
    if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) {
      await logEvent("warn", "pagos", "Se recibió un aviso de Stripe con firma no válida y se ignoró. Revisa STRIPE_WEBHOOK_SECRET si se repite.");
      return new Response("Firma no válida", { status: 400 });
    }
    const event = JSON.parse(raw) as {
      type: string;
      livemode?: boolean;
      data: { object: { id: string; payment_status?: string; amount_total?: number; metadata?: { order_id?: string } } };
    };
    // Un aviso de prueba nunca confirma un pedido con cobros reales (ni al revés).
    if (typeof event.livemode === "boolean" && event.livemode !== (stripeMode() === "live")) {
      await logEvent("warn", "pagos", `Se ignoró un aviso de Stripe en modo ${event.livemode ? "real" : "prueba"} que no coincide con la configuración actual.`);
      return new Response("Modo no coincidente", { status: 400 });
    }
    const s = event.data.object;
    const orderId = s.metadata?.order_id;
    if (!orderId) return new Response("ok");
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (s.payment_status === "paid") await confirmPaidFromWebhook(orderId, s.id, s.amount_total ?? -1, "Stripe");
        break;
      case "checkout.session.async_payment_failed":
        await markPaymentFailed(orderId, "Stripe informó de un pago fallido");
        await logEvent("warn", "pagos", "Un pago con Stripe ha fallado (por ejemplo, Bizum rechazado). El pedido sigue en el panel como no pagado.");
        break;
      case "checkout.session.expired":
        await markPaymentFailed(orderId, "la página de pago caducó sin completarse");
        break;
    }
    return new Response("ok");
  }

  if (provider === "paypal") {
    let event: { event_type?: string; resource?: { id?: string; custom_id?: string; amount?: { value?: string }; supplementary_data?: { related_ids?: { order_id?: string } } } };
    try {
      event = JSON.parse(raw);
    } catch {
      return new Response("JSON no válido", { status: 400 });
    }
    let ok = false;
    try {
      ok = await verifyPaypalWebhook(req.headers, event);
    } catch (e) {
      await logEvent("error", "pagos", "No se pudo verificar un aviso de PayPal (conexión o credenciales).", String(e));
    }
    if (!ok) {
      await logEvent("warn", "pagos", "Se recibió un aviso de PayPal que no superó la verificación y se ignoró. Revisa PAYPAL_WEBHOOK_ID si se repite.");
      return new Response("Firma no válida", { status: 400 });
    }
    const r = event.resource ?? {};
    const orderId = r.custom_id;
    if (!orderId) return new Response("ok");
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const cents = Math.round(parseFloat(r.amount?.value ?? "0") * 100);
      await confirmPaidFromWebhook(orderId, r.supplementary_data?.related_ids?.order_id ?? r.id ?? "paypal", cents, "PayPal");
    } else if (event.event_type === "PAYMENT.CAPTURE.DENIED" || event.event_type === "PAYMENT.CAPTURE.DECLINED") {
      await markPaymentFailed(orderId, "PayPal rechazó el cobro");
      await logEvent("warn", "pagos", "PayPal rechazó un cobro. El pedido sigue en el panel como no pagado.");
    }
    return new Response("ok");
  }

  return new Response("No encontrado", { status: 404 });
}
