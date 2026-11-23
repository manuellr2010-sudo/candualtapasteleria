import { redirect } from "next/navigation";
import { verifyPaypalReturn, verifyStripeReturn, type VerifyOutcome } from "@/lib/checkout";

export const dynamic = "force-dynamic";

/**
 * Retorno desde la pasarela. Volver aquí NO marca el pedido como pagado:
 * se consulta al proveedor (Stripe: sesión; PayPal: captura en servidor) y solo entonces se actualiza.
 */
export default async function PaymentReturn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const t = q.t ?? "";
  let outcome: VerifyOutcome = "invalid";
  if (q.proveedor === "stripe" && q.session_id) outcome = await verifyStripeReturn(t, q.session_id);
  else if (q.proveedor === "paypal" && q.token) outcome = await verifyPaypalReturn(t, q.token);
  if (outcome === "invalid" || !/^[A-Za-z0-9_-]{20,64}$/.test(t)) redirect("/?pago=desconocido");
  redirect(`/seguimiento/${t}?pago=${outcome}`);
}
