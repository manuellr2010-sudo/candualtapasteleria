import { getOrderByToken } from "@/lib/orders";
import { publicTracking } from "@/lib/delivery";

/** Estado del pedido para el enlace privado. Nunca incluye dirección ni datos del cliente. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const order = await getOrderByToken((await params).token);
  if (!order) return Response.json({ error: "No encontrado" }, { status: 404 });
  const tracking = order.status === "out_for_delivery" ? await publicTracking(order.id) : null;
  return Response.json(
    { status: order.status, statusUpdatedAt: order.statusUpdatedAt, tracking },
    { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } },
  );
}
