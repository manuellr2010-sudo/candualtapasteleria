import Link from "next/link";
import { listOrders, expireStalePayments } from "@/lib/orders";
import { listProducts } from "@/lib/products";
import { getSettings, pendingConfirmations } from "@/lib/settings";
import { activeRoute } from "@/lib/delivery";
import { integrations } from "@/lib/env";
import { recentLogs } from "@/lib/log";
import { dateLong, euros, todayMadrid } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export default async function Today() {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  await expireStalePayments();
  const [active, products, s, route, logs] = await Promise.all([listOrders("active"), listProducts(), getSettings(), activeRoute(), recentLogs(20)]);
  const today = todayMadrid();
  const newOnes = active.filter((o) => o.status === "received" && ["paid", "cod_pending"].includes(o.paymentStatus));
  const todays = active.filter((o) => o.requestedDate === today);
  const drafts = products.filter((p) => p.status === "draft");
  const published = products.filter((p) => p.status === "published");
  const pending = pendingConfirmations(s);
  const errors = logs.filter((l) => l.level === "error").length;
  const ints = integrations();

  return (
    <>
      <h1>Hola, {s.business.displayName}</h1>
      <p className="meta" style={{ marginTop: -8 }}>{dateLong(today).replace(/^./, (c) => c.toUpperCase())}</p>

      {route && (
        <Link href="/admin/reparto" className="notice notice--warn" style={{ display: "block", textDecoration: "none", marginBottom: 14 }}>
          <strong>Hay un reparto activo.</strong> Toca para volver a la pantalla de reparto.
        </Link>
      )}

      <div className="big-actions">
        <Link href="/admin/productos#subir" className="big-btn big-btn--cereza">
          📷 Subir fotos
          <small>Crea un borrador de producto</small>
        </Link>
        <Link href="/admin/reparto" className="big-btn">
          🚚 {route ? "Ver reparto" : "Empezar reparto"}
          <small>{route ? "Reparto en curso" : "Ordena las paradas"}</small>
        </Link>
      </div>

      <h2>Resumen</h2>
      <div className="stats">
        <Link href="/admin/pedidos" className="stat">
          <b>{newOnes.length}</b>
          <span>Pedidos nuevos</span>
        </Link>
        <Link href="/admin/pedidos?f=today" className="stat">
          <b>{todays.length}</b>
          <span>Para hoy</span>
        </Link>
        <Link href="/admin/productos?f=published" className="stat">
          <b>{published.length}</b>
          <span>Publicados</span>
        </Link>
        <Link href="/admin/productos" className="stat">
          <b>{drafts.length}</b>
          <span>Borradores</span>
        </Link>
      </div>

      {newOnes.length > 0 && (
        <>
          <h2>Por confirmar</h2>
          {newOnes.slice(0, 6).map((o) => (
            <Link key={o.id} href={`/admin/pedidos/${o.id}`} className="card card-link">
              <div className="row">
                <strong>{o.customerName}</strong>
                <span>{euros(o.totalCents)}</span>
              </div>
              <div className="meta">
                {o.number} · {o.deliveryType === "pickup" ? "Recogida" : o.locality} · {dateLong(o.requestedDate)}
              </div>
            </Link>
          ))}
        </>
      )}

      {(pending.length > 0 || errors > 0) && (
        <>
          <h2>Pendiente de revisar</h2>
          <div className="card stack">
            {pending.map((p) => (
              <p key={p} style={{ margin: 0 }}>
                ⚠️ {p}
              </p>
            ))}
            {errors > 0 && (
              <p style={{ margin: 0 }}>
                ❗ Hay {errors} errores recientes de pagos o mensajería. <Link href="/admin/ajustes/registro">Ver registro</Link>
              </p>
            )}
          </div>
        </>
      )}

      <h2>Conexiones</h2>
      <div className="card">
        {ints.map((i) => (
          <div className="integration" key={i.id}>
            <span className={`state-dot state-${i.state}`} aria-hidden />
            <div>
              <strong>{i.name}</strong>
              <div className="meta">{i.summary}</div>
            </div>
          </div>
        ))}
        <Link href="/admin/ajustes/integraciones" className="btn btn--ghost btn--block" style={{ marginTop: 10 }}>
          <span>Qué falta por conectar</span>
        </Link>
      </div>
    </>
  );
}
