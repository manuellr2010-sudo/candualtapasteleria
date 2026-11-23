import { activeRoute, deliverableOrders } from "@/lib/delivery";
import { getSettings } from "@/lib/settings";
import { mapTilesUrl } from "@/lib/env";
import { todayMadrid } from "@/lib/format";
import { RouteConsole, type ConsoleOrder } from "@/components/admin/RouteConsole";
import type { Order } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";

function toConsole(o: Order): ConsoleOrder {
  return {
    id: o.id,
    number: o.number,
    name: o.customerName,
    phone: o.customerPhone,
    address: o.address ?? "",
    locality: o.locality ?? "",
    date: o.requestedDate,
    slot: o.requestedSlot,
    notes: o.notes,
    priority: o.priority,
    status: o.status,
    lat: o.lat,
    lng: o.lng,
  };
}

export default async function DeliveryPage() {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const [ar, deliverable, s] = await Promise.all([activeRoute(), deliverableOrders(), getSettings()]);
  return (
    <>
      {!ar && <h1>Reparto</h1>}
      <RouteConsole
        today={todayMadrid()}
        deliverable={deliverable.map(toConsole)}
        route={ar ? { id: ar.route.id, sharing: ar.route.sharing, startedAt: ar.route.startedAt, lastAt: ar.route.lastAt } : null}
        stops={(ar?.stops ?? []).map((st) => ({ ...toConsole(st.order), position: st.position, stopStatus: st.status, reason: st.reason, stopNote: st.note }))}
        localities={s.delivery.localities.map((l) => ({ name: l.name, lat: l.lat, lng: l.lng }))}
        tilesUrl={mapTilesUrl()}
        statusLabels={s.statuses}
      />
    </>
  );
}
