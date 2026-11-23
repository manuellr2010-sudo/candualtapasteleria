import Link from "next/link";
import { listOrders, expireStalePayments } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { paymentStatusLabel } from "@/lib/messages";
import { dateLong, euros } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

const FILTERS = [
  { key: "active", label: "Activos" },
  { key: "today", label: "Para hoy" },
  { key: "pending_payment", label: "Pago pendiente" },
  { key: "all", label: "Todos" },
] as const;

export default async function Orders({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  await expireStalePayments();
  const f = ((await searchParams).f ?? "active") as (typeof FILTERS)[number]["key"];
  const filter = FILTERS.some((x) => x.key === f) ? f : "active";
  const [orders, s] = await Promise.all([listOrders(filter), getSettings()]);
  return (
    <>
      <h1>Pedidos</h1>
      <nav className="tabs" aria-label="Filtrar pedidos">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/admin/pedidos?f=${x.key}`} aria-current={filter === x.key ? "page" : undefined}>
            {x.label}
          </Link>
        ))}
      </nav>
      {orders.length === 0 && <p className="card">No hay pedidos en esta vista.</p>}
      {orders.map((o) => (
        <Link key={o.id} href={`/admin/pedidos/${o.id}`} className="card card-link">
          <div className="row">
            <strong style={{ fontSize: "1.08rem" }}>
              {o.customerName} {o.priority && <span className="chip chip--warn">Prioritario</span>}
            </strong>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>{euros(o.totalCents)}</span>
          </div>
          <div className="meta">
            {o.number} · {o.deliveryType === "pickup" ? "Recogida" : `Reparto · ${o.locality}`} · {o.requestedDate ? dateLong(o.requestedDate) : "sin fecha"}
            {o.requestedSlot ? ` · ${o.requestedSlot}` : ""}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <span className={`chip ${o.status === "received" ? "chip--warn" : o.status === "delivered" ? "chip--ok" : o.status === "cancelled" || o.status === "incident" ? "chip--err" : ""}`}>{s.statuses[o.status]}</span>
            <span className={`chip ${o.paymentStatus === "paid" ? "chip--ok" : o.paymentStatus === "cod_pending" ? "" : "chip--err"}`}>{paymentStatusLabel(o)}</span>
            {o.paymentMode === "test" && <span className="chip chip--test">PRUEBA</span>}
          </div>
        </Link>
      ))}
    </>
  );
}
