import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder, orderEvents } from "@/lib/orders";
import { orderNotifications } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { baseUrl, whatsappSendReady } from "@/lib/env";
import { ownerOrderText, paymentStatusLabel } from "@/lib/messages";
import { dateLong, dateTime, euros, mapsLink, telLink, waLink } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { orderForgetAction, orderPriorityAction, orderStatusAction } from "../../../actions";
import { TrackingLinkButton } from "@/components/admin/TrackingLinkButton";
import { requireAdmin } from "@/lib/auth";

const NEXT: OrderStatus[] = ["received", "confirmed", "preparing", "out_for_delivery", "delivered", "incident", "cancelled"];

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const { id } = await params;
  const o = await getOrder(id);
  if (!o) notFound();
  const [s, events, notes] = await Promise.all([getSettings(), orderEvents(id), orderNotifications(id)]);
  const panelUrl = `${baseUrl()}/admin/pedidos/${o.id}`;
  const customerPhone = o.customerPhone.replace(/^\+|^00/, "");
  const customerWa = customerPhone.startsWith("34") && customerPhone.length === 11 ? customerPhone : `34${customerPhone}`;

  return (
    <>
      <Link href="/admin/pedidos" className="meta">
        ← Pedidos
      </Link>
      <h1>
        {o.customerName} <span className="meta" style={{ fontSize: "1rem" }}>{o.number}</span>
      </h1>

      <div className="card stack">
        <div className="row">
          <strong>Estado actual</strong>
          <span className="chip chip--warn">{s.statuses[o.status]}</span>
        </div>
        <span className="meta">Actualizado: {dateTime(o.statusUpdatedAt)}</span>
        <div className="actions">
          {NEXT.filter((st) => st !== o.status).map((st) => (
            <form key={st} action={orderStatusAction.bind(null, o.id, st)}>
              <button className={`btn btn--sm ${st === "cancelled" || st === "incident" ? "btn--ghost" : ""}`}>
                <span>{s.statuses[st]}</span>
              </button>
            </form>
          ))}
        </div>
        {o.whatsappConsent && <p className="hint" style={{ margin: 0 }}>El cliente aceptó avisos por WhatsApp: se le avisa al confirmar, salir a reparto y entregar {whatsappSendReady() ? "" : "(cuando WhatsApp esté conectado)"}.</p>}
      </div>

      <h2>Contacto y entrega</h2>
      <div className="card stack">
        <div className="actions">
          <a className="btn" href={telLink(o.customerPhone)}>
            <span>Llamar · {o.customerPhone}</span>
          </a>
          <a className="btn btn--ghost" href={waLink(customerWa, `Hola ${o.customerName}, te escribo de Candú por tu pedido ${o.number}.`)} target="_blank" rel="noopener noreferrer">
            <span>WhatsApp al cliente</span>
          </a>
        </div>
        <dl className="pdp__facts" style={{ margin: 0 }}>
          <div>
            <dt>Modalidad</dt>
            <dd>{o.deliveryType === "pickup" ? "Recogida en el obrador" : "Reparto a domicilio"}</dd>
          </div>
          {o.deliveryType === "delivery" && (
            <div>
              <dt>Dirección</dt>
              <dd>
                {o.address}, {o.locality}{" "}
                <a href={mapsLink(`${o.address}, ${o.locality}, Granada`, o.lat, o.lng)} target="_blank" rel="noopener noreferrer">
                  (abrir en mapas)
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt>Fecha</dt>
            <dd>
              {dateLong(o.requestedDate)} {o.requestedSlot && `· ${o.requestedSlot}`}
            </dd>
          </div>
          {o.notes && (
            <div>
              <dt>Notas</dt>
              <dd>{o.notes}</dd>
            </div>
          )}
        </dl>
        <form action={orderPriorityAction.bind(null, o.id, !o.priority)}>
          <button className="btn btn--ghost btn--sm">
            <span>{o.priority ? "Quitar prioridad en el reparto" : "Marcar como prioritario en el reparto"}</span>
          </button>
        </form>
      </div>

      <h2>Productos y pago</h2>
      <div className="card">
        {o.items.map((it) => (
          <div className="summary-line" key={it.productId}>
            <span>
              {it.qty} × {it.title}
            </span>
            <span>{euros(it.unitCents * it.qty)}</span>
          </div>
        ))}
        {o.deliveryType === "delivery" && (
          <div className="summary-line">
            <span>Entrega</span>
            <span>{o.deliveryFeeCents === null ? "Sin importe configurado" : euros(o.deliveryFeeCents)}</span>
          </div>
        )}
        <div className="totals">
          <span>Total</span>
          <strong>{euros(o.totalCents)}</strong>
        </div>
        <p style={{ margin: "10px 0 0" }}>
          <span className={`chip ${o.paymentStatus === "paid" ? "chip--ok" : "chip--warn"}`}>{paymentStatusLabel(o)}</span>{" "}
          {o.paymentMode === "test" && <span className="chip chip--test">MODO PRUEBA: no es dinero real</span>}
        </p>
        {o.paymentRef && <p className="meta" style={{ margin: "6px 0 0" }}>Referencia del proveedor: {o.paymentRef}</p>}
      </div>

      <h2>Avisos</h2>
      <div className="card stack">
        <a className="btn btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(ownerOrderText(o, panelUrl))}`} target="_blank" rel="noopener noreferrer">
          <span>Abrir WhatsApp con el resumen del pedido</span>
        </a>
        <p className="hint" style={{ margin: 0 }}>Abre WhatsApp con el texto preparado para reenviarlo (por ejemplo, a quien reparte). No se envía nada hasta que pulses «Enviar».</p>
        <TrackingLinkButton orderId={o.id} customerWa={customerWa} number={o.number} />
        {notes.length === 0 ? (
          <p className="meta" style={{ margin: 0 }}>Sin avisos automáticos registrados.</p>
        ) : (
          notes.map((n, i) => (
            <div key={i} className="log-item">
              <strong>{n.target === "owner" ? "Aviso a Candú" : "Aviso al cliente"}</strong> · {n.status === "sent" ? "enviado" : n.status === "failed" ? "fallido" : "no enviado automáticamente"}
              <div className="meta">
                {dateTime(n.created_at)} · {n.detail}
              </div>
            </div>
          ))
        )}
      </div>

      <h2>Historial</h2>
      <div className="card">
        {events.map((e) => (
          <div key={e.id} className="log-item">
            <div>{e.message}</div>
            <div className="meta">{dateTime(e.createdAt)}</div>
          </div>
        ))}
      </div>

      {["delivered", "cancelled"].includes(o.status) && o.customerName !== "Borrado" && (
        <form action={orderForgetAction.bind(null, o.id)} style={{ marginTop: 20 }}>
          <button className="btn btn--ghost btn--sm">
            <span>Borrar datos personales del cliente (nombre, teléfono, dirección, notas)</span>
          </button>
        </form>
      )}
    </>
  );
}
