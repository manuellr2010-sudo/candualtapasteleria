import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderByToken } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { publicTracking } from "@/lib/delivery";
import { mapTilesUrl } from "@/lib/env";
import { customerToOwnerText, paymentStatusLabel } from "@/lib/messages";
import { dateLong, dateTime, euros, waLink } from "@/lib/format";
import { ORDER_FLOW } from "@/lib/types";
import { TrackingLive } from "@/components/site/TrackingLive";
import { IconWhatsapp } from "@/components/site/Icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seguimiento de tu pedido", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function TrackingPage({ params, searchParams }: Props) {
  const { token } = await params;
  const q = await searchParams;
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const s = await getSettings();
  const labels = s.statuses;
  const tracking = order.status === "out_for_delivery" ? await publicTracking(order.id) : null;
  const currentIdx = ORDER_FLOW.indexOf(order.status);
  const offFlow = currentIdx === -1;
  const canRetry = order.paymentMethod !== "cod" && ["pending", "failed"].includes(order.paymentStatus) && order.status === "received";

  return (
    <div className="page wrap">
      {q.nuevo && (
        <p className="notice notice--ok" role="status" style={{ marginBottom: 18 }}>
          <strong>¡Pedido recibido!</strong> Guarda este enlace: es tu acceso privado para seguir el pedido. No lo compartas.
        </p>
      )}
      {q.pago === "paid" && (
        <p className="notice notice--ok" role="status" style={{ marginBottom: 18 }}>
          <strong>Pago confirmado por el proveedor.</strong> Guarda este enlace para seguir tu pedido.
        </p>
      )}
      {q.pago === "pending" && order.paymentStatus !== "paid" && (
        <p className="notice notice--warn" role="status" style={{ marginBottom: 18 }}>
          Estamos esperando la confirmación del pago por parte del proveedor. Recarga esta página en unos minutos.
        </p>
      )}
      {(q.pago === "cancelado" || q.pago === "failed") && order.paymentStatus !== "paid" && (
        <p className="notice notice--err" role="alert" style={{ marginBottom: 18 }}>
          El pago no se ha completado. Tu pedido está reservado durante 45 minutos: puedes volver a intentarlo.
        </p>
      )}

      <section className="track-hero grain on-dark" aria-labelledby="estado">
        <span className="eyebrow" style={{ color: "var(--salvia)" }}>
          Pedido {order.number}
        </span>
        <h1 id="estado">{labels[order.status]}</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>Última actualización: {dateTime(order.statusUpdatedAt)}</p>
        {offFlow ? (
          <p className="notice" style={{ marginTop: 18, background: "rgba(244,237,226,.1)", color: "var(--cream)", borderColor: "var(--oro)" }}>
            {order.status === "cancelled" ? "Este pedido está cancelado." : "Ha habido una incidencia con la entrega. Candú se pondrá en contacto contigo."}
          </p>
        ) : (
          <ol className="timeline">
            {ORDER_FLOW.map((st, i) => (
              <li key={st} data-state={i < currentIdx ? "done" : i === currentIdx ? "current" : "todo"} aria-current={i === currentIdx ? "step" : undefined}>
                <span className="tl-dot" aria-hidden>
                  {i < currentIdx ? "✓" : i + 1}
                </span>
                <strong>{labels[st]}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="track-grid">
        <div>
          {order.status === "out_for_delivery" && (
            <TrackingLive token={token} initial={tracking} tilesUrl={mapTilesUrl()} />
          )}
          <div className="summary-card" style={{ marginTop: order.status === "out_for_delivery" ? 20 : 0 }}>
            <h2>Detalle</h2>
            {order.items.map((it) => (
              <div className="summary-line" key={it.productId}>
                <span>
                  {it.qty} × {it.title}
                </span>
                <span>{euros(it.unitCents * it.qty)}</span>
              </div>
            ))}
            {order.deliveryType === "delivery" && (
              <div className="summary-line">
                <span>Entrega</span>
                <span>{order.deliveryFeeCents === null ? "A confirmar" : order.deliveryFeeCents === 0 ? "Sin coste" : euros(order.deliveryFeeCents)}</span>
              </div>
            )}
            <div className="totals" style={{ marginTop: 8 }}>
              <span>Total</span>
              <strong>{euros(order.totalCents)}</strong>
            </div>
          </div>
        </div>
        <div className="summary-card">
          <h2>Entrega y pago</h2>
          <dl className="pdp__facts" style={{ margin: 0 }}>
            <div>
              <dt>Modalidad</dt>
              <dd>{order.deliveryType === "pickup" ? "Recogida en el obrador" : `Reparto en ${order.locality}`}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>
                {dateLong(order.requestedDate)}
                {order.requestedSlot ? ` · ${order.requestedSlot}` : ""}
              </dd>
            </div>
            <div>
              <dt>Pago</dt>
              <dd>
                {paymentStatusLabel(order)}
                {order.paymentMode === "test" && (
                  <>
                    {" "}
                    <span className="chip chip--test">MODO PRUEBA</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
          {canRetry && (
            <form action="/api/orders" method="post" style={{ marginTop: 18 }}>
              <input type="hidden" name="t" value={token} />
              <button className="btn btn--cereza btn--block" type="submit">
                <span>Volver a intentar el pago</span>
              </button>
            </form>
          )}
          <a className="btn btn--ghost btn--block" style={{ marginTop: 14 }} href={waLink(s.business.whatsapp, customerToOwnerText(order))} target="_blank" rel="noopener noreferrer">
            <IconWhatsapp /> <span>Avisar a Candú por WhatsApp</span>
          </a>
          <p className="hint" style={{ marginTop: 8 }}>
            Se abrirá WhatsApp con el resumen preparado. El mensaje no se envía hasta que tú pulses «Enviar». Tu pedido ya está guardado en el sistema de Candú.
          </p>
        </div>
      </div>
    </div>
  );
}
