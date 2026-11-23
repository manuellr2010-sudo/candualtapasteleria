import { z } from "zod";
import { publicProductsByIds } from "@/lib/catalog";

const body = z.object({ ids: z.array(z.string().min(1).max(40)).max(30) });

/** Devuelve el estado actual (precio, disponibilidad, unidades) de los productos de la cesta. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  const products = await publicProductsByIds(parsed.data.ids);
  return Response.json({ products }, { headers: { "Cache-Control": "no-store" } });
}
