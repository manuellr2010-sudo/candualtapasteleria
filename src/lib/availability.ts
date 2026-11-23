/** Reglas de disponibilidad compartidas por la web pública, la cesta y el servidor. */
export interface AvailabilityInput {
  status: string;
  soldOut: boolean;
  unitsAvailable: number | null;
  priceCents: number | null;
  orderDeadline: string | null;
}

export type Availability =
  | { buyable: true; label: string; remaining: number | null }
  | { buyable: false; label: string; reason: "sold_out" | "deadline" | "no_price" | "not_published" };

export function availability(p: AvailabilityInput, now = Date.now()): Availability {
  if (p.status !== "published") return { buyable: false, label: "No disponible", reason: "not_published" };
  if (p.soldOut || (p.unitsAvailable !== null && p.unitsAvailable <= 0))
    return { buyable: false, label: "Agotado", reason: "sold_out" };
  if (p.orderDeadline && new Date(p.orderDeadline).getTime() < now)
    return { buyable: false, label: "Pedidos cerrados", reason: "deadline" };
  if (p.priceCents === null) return { buyable: false, label: "Precio a consultar", reason: "no_price" };
  const remaining = p.unitsAvailable;
  const label = remaining !== null && remaining <= 5 ? `Quedan ${remaining}` : "Disponible";
  return { buyable: true, label, remaining };
}
