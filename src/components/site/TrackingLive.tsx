"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { minutesAgo, timeOnly } from "@/lib/format";
import type { MapMarker } from "./LeafletMap";

const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), { ssr: false });

interface Tracking {
  inRoute: boolean;
  stopsBefore: number;
  sharing: boolean;
  live: { lat: number; lng: number; accuracy: number | null; at: string } | null;
  lastAt: string | null;
  stale: boolean;
  manual: { locality: string; at: string } | null;
}

/**
 * Seguimiento en directo para el cliente. Consulta cada 10 s; nunca presenta
 * una posición antigua como actual (si no es reciente, se oculta del mapa).
 */
export function TrackingLive({ token, initial, tilesUrl }: { token: string; initial: Tracking | null; tilesUrl: string | null }) {
  const router = useRouter();
  const [t, setT] = useState<Tracking | null>(initial);
  const [offline, setOffline] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/track/${token}`, { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = (await r.json()) as { status: string; tracking: Tracking | null };
        if (!alive) return;
        setOffline(false);
        if (d.status !== "out_for_delivery") router.refresh();
        setT(d.tracking);
      } catch {
        if (alive) setOffline(true);
      }
    };
    const id = setInterval(poll, 10_000);
    const clock = setInterval(() => tick((x) => x + 1), 15_000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(clock);
    };
  }, [token, router]);

  const markers: MapMarker[] = t?.live ? [{ lat: t.live.lat, lng: t.live.lng, label: "Repartidor (posición reciente)", kind: "driver" }] : [];

  return (
    <section className="summary-card" aria-labelledby="live-title" aria-live="polite">
      <h2 id="live-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {t?.live && <span className="dot dot--pulse" style={{ color: "var(--cereza)" }} aria-hidden />}
        Tu pedido va en camino
      </h2>
      {!t ? (
        <p className="muted" style={{ margin: 0 }}>
          El reparto está en marcha. La información en directo aparecerá aquí si el repartidor la comparte.
        </p>
      ) : (
        <>
          <p style={{ marginBottom: 12 }}>
            {t.stopsBefore === 0 ? "¡Eres la siguiente entrega!" : `Quedan ${t.stopsBefore} ${t.stopsBefore === 1 ? "entrega" : "entregas"} antes de la tuya.`}
          </p>
          {t.live ? (
            <>
              {tilesUrl ? (
                <LeafletMap tilesUrl={tilesUrl} markers={markers} height={280} ariaLabel="Mapa con la posición del repartidor" />
              ) : (
                <p className="notice">Posición recibida, pero el mapa no está activado en esta web.</p>
              )}
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Posición actualizada a las {timeOnly(t.live.at)}
                {t.live.accuracy ? ` · precisión aproximada ${Math.round(t.live.accuracy)} m` : ""}. Solo ves al repartidor mientras tu pedido está en reparto.
              </p>
            </>
          ) : t.manual ? (
            <p className="notice">
              El repartidor indicó que está por <strong>{t.manual.locality}</strong> a las {timeOnly(t.manual.at)} (dato aproximado, marcado a mano).
            </p>
          ) : t.stale && t.lastAt ? (
            <p className="notice notice--warn">
              La ubicación no se actualiza desde las {timeOnly(t.lastAt)} (hace {minutesAgo(t.lastAt)} min). El móvil del repartidor puede tener la pantalla bloqueada o haber perdido cobertura, así que no te mostramos una posición que podría no ser la actual.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {t.sharing ? "Esperando la primera posición del repartidor…" : "El repartidor no está compartiendo su ubicación en este reparto."}
            </p>
          )}
        </>
      )}
      {offline && <p className="field-error" style={{ marginTop: 10 }}>Sin conexión: no podemos actualizar el seguimiento ahora mismo.</p>}
    </section>
  );
}
