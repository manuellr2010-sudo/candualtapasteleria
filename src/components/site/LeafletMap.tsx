"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, LayerGroup } from "leaflet";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  kind: "driver" | "stop" | "origin";
  number?: number;
  muted?: boolean;
}

/** Mapa ligero (Leaflet). Solo se usa si hay un proveedor de teselas configurado. */
export function LeafletMap({ tilesUrl, markers, height = 320, ariaLabel }: { tilesUrl: string; markers: MapMarker[]; height?: number; ariaLabel: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      const m = mod.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      const osm = tilesUrl.includes("openstreetmap.org");
      mod.tileLayer(tilesUrl, {
        maxZoom: 19,
        attribution: osm ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' : "",
      }).addTo(m);
      m.setView([37.55, -2.79], 11);
      layer.current = mod.layerGroup().addTo(m);
      map.current = m;
      draw();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilesUrl]);

  function draw() {
    const mod = L.current;
    if (!mod || !map.current || !layer.current) return;
    layer.current.clearLayers();
    const pts: [number, number][] = [];
    for (const mk of markers) {
      const color = mk.kind === "driver" ? "#a8223a" : mk.kind === "origin" ? "#0d2b29" : mk.muted ? "#9a8a7c" : "#22150f";
      const html =
        mk.kind === "driver"
          ? `<span style="display:block;width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 6px rgba(168,34,58,.25)"></span>`
          : `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:${color};color:#fff;font:600 13px system-ui;border:2px solid #fff"><b style="transform:rotate(45deg)">${mk.number ?? "•"}</b></span>`;
      const icon = mod.divIcon({ html, className: "", iconSize: [30, 30], iconAnchor: mk.kind === "driver" ? [11, 11] : [4, 30] });
      mod.marker([mk.lat, mk.lng], { icon, title: mk.label, alt: mk.label, keyboard: true }).bindTooltip(mk.label).addTo(layer.current);
      pts.push([mk.lat, mk.lng]);
    }
    if (pts.length && !fitted.current) {
      if (pts.length === 1) map.current.setView(pts[0], 14);
      else map.current.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
      fitted.current = true;
    }
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return <div ref={el} className="map-box" style={{ height }} role="region" aria-label={ariaLabel} />;
}
