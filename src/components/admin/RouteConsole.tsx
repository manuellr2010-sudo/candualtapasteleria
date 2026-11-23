"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dateLong, mapsLink, telLink, timeOnly } from "@/lib/format";
import type { MapMarker } from "@/components/site/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/site/LeafletMap").then((m) => m.LeafletMap), { ssr: false });

export interface ConsoleOrder {
  id: string;
  number: string;
  name: string;
  phone: string;
  address: string;
  locality: string;
  date: string | null;
  slot: string;
  notes: string;
  priority: boolean;
  status: string;
  lat: number | null;
  lng: number | null;
}

export interface ConsoleStop extends ConsoleOrder {
  position: number;
  stopStatus: "pending" | "delivered" | "incident";
  reason: string;
  stopNote: string;
}

interface Props {
  today: string;
  deliverable: ConsoleOrder[];
  route: { id: string; sharing: boolean; startedAt: string; lastAt: string | null } | null;
  stops: ConsoleStop[];
  localities: { name: string; lat: number | null; lng: number | null }[];
  tilesUrl: string | null;
  statusLabels: Record<string, string>;
}

type GeoState = "idle" | "asking" | "active" | "denied" | "unavailable" | "paused" | "offline" | "off";

async function api(op: string, body: Record<string, unknown> = {}) {
  const r = await fetch("/api/admin/reparto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, ...body }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Error de conexión");
  return data;
}

export function RouteConsole(p: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() => p.deliverable.filter((o) => !o.date || o.date <= p.today).map((o) => o.id));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>(p.route?.sharing ? "idle" : "off");
  const [lastSent, setLastSent] = useState<string | null>(p.route?.lastAt ?? null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [pausedSince, setPausedSince] = useState<string | null>(null);
  const [pauseNote, setPauseNote] = useState<string | null>(null);
  const [order, setOrder] = useState<ConsoleStop[]>(p.stops);
  const [manualLoc, setManualLoc] = useState("");
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const lastPost = useRef<{ t: number; lat: number; lng: number } | null>(null);

  useEffect(() => setOrder(p.stops), [p.stops]);

  /* ── Ubicación: solo mientras esta pantalla está abierta y el reparto activo ── */
  const stopWatching = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const startWatching = useCallback(() => {
    if (!p.route || !("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    if (!window.isSecureContext) {
      setGeo("unavailable");
      setError("La ubicación solo funciona con HTTPS (o en localhost).");
      return;
    }
    setGeo("asking");
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setMe({ lat, lng });
        setGeo(navigator.onLine ? "active" : "offline");
        const prev = lastPost.current;
        const moved = prev ? Math.hypot(lat - prev.lat, lng - prev.lng) * 111000 : Infinity;
        if (prev && Date.now() - prev.t < 15000 && moved < 60) return; // como mucho cada 15 s salvo que se mueva
        lastPost.current = { t: Date.now(), lat, lng };
        try {
          const d = await api("location", { routeId: p.route!.id, lat, lng, accuracy });
          setLastSent(d.at);
        } catch {
          setGeo("offline");
        }
      },
      (err) => {
        setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((w) => (wakeLock.current = w)).catch(() => {});
    }
  }, [p.route]);

  useEffect(() => {
    if (p.route?.sharing) startWatching();
    return stopWatching;
  }, [p.route?.id, p.route?.sharing, startWatching, stopWatching]);

  // Avisos si la página se oculta (pantalla bloqueada, otra app): el navegador puede pausar la ubicación.
  useEffect(() => {
    if (!p.route) return;
    const onVis = () => {
      if (document.hidden) setPausedSince(new Date().toISOString());
      else if (pausedSince) {
        setPauseNote(`La ubicación pudo quedar en pausa desde las ${timeOnly(pausedSince)} hasta ahora (pantalla bloqueada o app en segundo plano).`);
        setPausedSince(null);
        if (p.route?.sharing && "wakeLock" in navigator) navigator.wakeLock.request("screen").then((w) => (wakeLock.current = w)).catch(() => {});
      }
    };
    const onOff = () => setGeo((g) => (g === "active" ? "offline" : g));
    const onOn = () => setGeo((g) => (g === "offline" ? "active" : g));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, [p.route, pausedSince]);

  /* ── Acciones ── */
  async function begin(sharing: boolean) {
    setBusy(true);
    setError(null);
    let origin: { lat: number; lng: number } | null = null;
    if (sharing && "geolocation" in navigator) {
      origin = await new Promise((res) =>
        navigator.geolocation.getCurrentPosition(
          (pos) => res({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => res(null),
          { enableHighAccuracy: true, timeout: 15000 },
        ),
      );
      if (!origin) setError("No se pudo obtener la ubicación (permiso denegado o sin señal). El reparto empieza sin compartir ubicación; puedes indicar la localidad a mano.");
    }
    try {
      await api("start", { orderIds: selected, sharing: sharing && Boolean(origin), origin });
      setConsent(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function end() {
    if (!p.route || !confirm("¿Terminar el reparto? Se dejará de enviar tu ubicación en este momento.")) return;
    stopWatching(); // primero se corta la captura, antes incluso de avisar al servidor
    setGeo("off");
    setBusy(true);
    try {
      await api("end", { routeId: p.route.id });
    } catch (e) {
      setError(`${(e as Error).message}. La ubicación ya no se envía desde este móvil.`);
    }
    setBusy(false);
    router.refresh();
  }

  async function reorder(next: ConsoleStop[]) {
    setOrder(next);
    try {
      await api("reorder", { routeId: p.route!.id, orderIds: next.map((s) => s.id) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const n = [...order];
    [n[i], n[j]] = [n[j], n[i]];
    reorder(n);
  };

  async function mark(id: string, status: "delivered" | "incident" | "pending") {
    let note = "";
    if (status === "incident") {
      const n = prompt("¿Qué ha pasado? (se guarda en el pedido)");
      if (n === null) return;
      note = n;
    }
    setOrder((o) => o.map((s) => (s.id === id ? { ...s, stopStatus: status } : s)));
    try {
      await api("mark", { routeId: p.route!.id, orderId: id, status, note });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function recompute() {
    setBusy(true);
    try {
      await api("suggest", { routeId: p.route!.id, origin: me });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function sendManual() {
    if (!manualLoc || !p.route) return;
    try {
      await api("manual", { routeId: p.route.id, locality: manualLoc });
      setPauseNote(`Has indicado que estás por ${manualLoc}. Los clientes lo verán como dato aproximado.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const markers: MapMarker[] = useMemo(() => {
    const locPoint = (s: ConsoleStop) => {
      if (s.lat !== null && s.lng !== null) return { lat: s.lat, lng: s.lng };
      const l = p.localities.find((x) => x.name === s.locality);
      return l && l.lat !== null && l.lng !== null ? { lat: l.lat, lng: l.lng } : null;
    };
    const ms: MapMarker[] = [];
    order.forEach((s, i) => {
      const pt = locPoint(s);
      if (pt) ms.push({ ...pt, label: `${i + 1}. ${s.locality}${s.lat === null ? " (centro aprox.)" : ""}`, kind: "stop", number: i + 1, muted: s.stopStatus !== "pending" });
    });
    if (me) ms.push({ ...me, label: "Tú", kind: "driver" });
    return ms;
  }, [order, me, p.localities]);

  const geoText: Record<GeoState, string> = {
    idle: "Preparando ubicación…",
    asking: "Esperando permiso y señal GPS…",
    active: "Compartiendo ubicación con los clientes de este reparto",
    denied: "Permiso de ubicación denegado: no se comparte",
    unavailable: "Ubicación no disponible en este móvil",
    paused: "Ubicación en pausa",
    offline: "Sin conexión: la ubicación no llega a los clientes",
    off: "No se comparte la ubicación",
  };

  /* ── Sin reparto activo ── */
  if (!p.route) {
    return (
      <div className="stack">
        {error && <p className="notice notice--err">{error}</p>}
        {p.deliverable.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0 }}>No hay pedidos con reparto a domicilio pendientes. Los pedidos aparecen aquí cuando están pagados o con pago al recibir.</p>
          </div>
        ) : (
          <>
            <p className="meta" style={{ margin: 0 }}>Elige los pedidos que vas a llevar hoy:</p>
            {p.deliverable.map((o) => (
              <label key={o.id} className="card check" style={{ alignItems: "flex-start" }}>
                <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))} />
                <span style={{ display: "grid", gap: 2 }}>
                  <strong>
                    {o.locality} · {o.name} {o.priority && <span className="chip chip--warn">Prioritario</span>}
                  </strong>
                  <span className="meta">
                    {o.number} · {o.date ? dateLong(o.date) : "sin fecha"} {o.slot && `· ${o.slot}`}
                  </span>
                  {o.status === "received" && <span className="meta" style={{ color: "var(--warn)" }}>Aún sin confirmar</span>}
                </span>
              </label>
            ))}
            <div className="sticky-bar">
              <button type="button" className="btn btn--cereza btn--lg" disabled={!selected.length || busy} onClick={() => setConsent(true)}>
                <span>Empezar reparto ({selected.length})</span>
              </button>
            </div>
          </>
        )}

        {consent && (
          <div className="drawer-backdrop" style={{ display: "grid", placeItems: "end center", padding: "12px 12px calc(84px + env(safe-area-inset-bottom))", overflowY: "auto" }}>
            <div className="card stack" role="dialog" aria-modal="true" aria-labelledby="consent-title" style={{ width: "min(520px,100%)", marginBottom: "env(safe-area-inset-bottom)" }}>
              <h2 id="consent-title" style={{ margin: 0 }}>¿Compartir tu ubicación durante el reparto?</h2>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                <li>
                  <b>Qué se comparte:</b> la posición aproximada de este móvil, como mucho cada 15 segundos.
                </li>
                <li>
                  <b>Con quién:</b> solo con los {selected.length} clientes de este reparto, desde su enlace privado, mientras su pedido está pendiente de entregar.
                </li>
                <li>
                  <b>Hasta cuándo:</b> hasta que pulses «Terminar reparto» o cierres esta pantalla. No se guarda el recorrido: solo la última posición, que se borra al terminar.
                </li>
                <li>
                  <b>Límites:</b> si bloqueas la pantalla, cambias de app o pierdes cobertura, el navegador puede pausar la ubicación. Los clientes verán que no está actualizada.
                </li>
              </ul>
              <p className="meta" style={{ margin: 0 }}>Tu navegador te pedirá permiso a continuación.</p>
              <button type="button" className="btn btn--cereza btn--lg" disabled={busy} onClick={() => begin(true)}>
                <span>Compartir ubicación y empezar</span>
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => begin(false)}>
                <span>Empezar sin compartir ubicación</span>
              </button>
              <button type="button" className="btn btn--ghost" style={{ border: 0 }} onClick={() => setConsent(false)}>
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Reparto activo ── */
  const pending = order.filter((s) => s.stopStatus === "pending").length;
  return (
    <div className="stack">
      <div className="route-banner" role="status" aria-live="polite">
        <div className="row">
          <strong>
            <span className="dot dot--pulse" aria-hidden /> Reparto activo
          </strong>
          <button type="button" className="btn btn--light btn--sm" onClick={end} disabled={busy}>
            <span>Terminar reparto</span>
          </button>
        </div>
        <span style={{ fontSize: ".92rem" }}>
          {geoText[geo]} · Última actualización enviada: {lastSent ? timeOnly(lastSent) : "ninguna todavía"} · Quedan {pending}
        </span>
      </div>

      {error && <p className="notice notice--err">{error}</p>}
      {pauseNote && (
        <p className="notice notice--warn">
          {pauseNote}{" "}
          <button type="button" className="remove" onClick={() => setPauseNote(null)}>
            Cerrar
          </button>
        </p>
      )}
      {p.route.sharing && <p className="hint" style={{ margin: 0 }}>Mantén esta pantalla abierta mientras repartes. Si el móvil la pausa, los clientes verán la hora de la última posición, nunca una posición antigua como actual.</p>}

      {(geo === "denied" || geo === "unavailable" || !p.route.sharing) && (
        <div className="card stack">
          <strong>Indicar dónde estás a mano</strong>
          <div className="row">
            <select className="select" value={manualLoc} onChange={(e) => setManualLoc(e.target.value)} aria-label="Localidad actual">
              <option value="">Elige localidad</option>
              {p.localities.map((l) => (
                <option key={l.name}>{l.name}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={sendManual} disabled={!manualLoc}>
              <span>Marcar</span>
            </button>
          </div>
        </div>
      )}

      {p.tilesUrl ? (
        markers.length > 0 && <LeafletMap tilesUrl={p.tilesUrl} markers={markers} height={300} ariaLabel="Mapa con las paradas numeradas" />
      ) : (
        <p className="notice">Mapa no conectado: usa la lista ordenada y el botón «Navegar» de cada parada.</p>
      )}

      <div className="row">
        <h2 style={{ margin: 0 }}>Paradas</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={recompute} disabled={busy}>
          <span>Recalcular orden</span>
        </button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Orden sugerido: primero las franjas más tempranas y los pedidos prioritarios; después, siempre la parada más cercana a la anterior. Puedes cambiarlo con las flechas.
      </p>

      {order.map((s, i) => (
        <div key={s.id} className="card stop" data-status={s.stopStatus}>
          <span className="stop__n" aria-label={`Parada ${i + 1}`}>
            {s.stopStatus === "delivered" ? "✓" : s.stopStatus === "incident" ? "!" : i + 1}
          </span>
          <div className="stack" style={{ gap: 8 }}>
            <div>
              <strong style={{ fontSize: "1.1rem" }}>{s.name}</strong>
              <div>{s.address}</div>
              <div className="meta">
                {s.locality} · {s.slot || "sin franja"} · {s.number}
              </div>
              {s.notes && <div style={{ marginTop: 4 }}>📝 {s.notes}</div>}
              {s.reason && <div className="reason">{s.reason}</div>}
              {s.stopNote && <div className="meta">Incidencia: {s.stopNote}</div>}
            </div>
            <div className="actions">
              <a className="btn btn--sm" href={mapsLink(`${s.address}, ${s.locality}, Granada`, s.lat, s.lng)} target="_blank" rel="noopener noreferrer">
                <span>Navegar</span>
              </a>
              <a className="btn btn--ghost btn--sm" href={telLink(s.phone)}>
                <span>Llamar</span>
              </a>
              {s.stopStatus === "pending" ? (
                <>
                  <button type="button" className="btn btn--cereza btn--sm" onClick={() => mark(s.id, "delivered")}>
                    <span>Entregado</span>
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => mark(s.id, "incident")}>
                    <span>Incidencia</span>
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => mark(s.id, "pending")}>
                  <span>Deshacer</span>
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir parada">
                <span>↑</span>
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Bajar parada">
                <span>↓</span>
              </button>
            </div>
          </div>
        </div>
      ))}
      <div className="sticky-bar">
        <button type="button" className="btn btn--lg" onClick={end} disabled={busy}>
          <span>Terminar reparto</span>
        </button>
      </div>
    </div>
  );
}
