"use client";

import { useEffect, useState } from "react";
import { motionReduced, setMotion } from "@/lib/motion";

/** Interruptor de animaciones: por defecto sigue al sistema, pero se puede cambiar aquí. */
export function MotionToggle({ variant = "footer" }: { variant?: "footer" | "inline" }) {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => setReduced(motionReduced()), []);
  if (reduced === null) return null;
  const toggle = () => {
    setMotion(reduced ? "full" : "reduced");
    window.location.reload();
  };
  if (variant === "inline") {
    return (
      <button type="button" className="motion-pill" onClick={toggle}>
        <span aria-hidden>✦</span> {reduced ? "Activar animaciones y 3D en movimiento" : "Reducir animaciones"}
      </button>
    );
  }
  return (
    <button type="button" className="toggle" aria-pressed={!reduced} onClick={toggle}>
      <span className="toggle__track" aria-hidden />
      Animaciones {reduced ? "reducidas" : "completas"}
    </button>
  );
}

/**
 * Microinteracciones globales (solo con ratón o lápiz):
 * [data-tilt] se inclina hacia el cursor con un brillo suave; [data-magnetic] se acerca al cursor.
 * Con movimiento reducido solo queda el brillo, sin inclinación ni desplazamiento.
 */
export function Interactions() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const reduced = motionReduced();
    let active: HTMLElement | null = null;
    let mag: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tilt]");
      if (active && active !== el) reset(active);
      active = el;
      if (el) {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${x * 100}%`);
        el.style.setProperty("--my", `${y * 100}%`);
        if (!reduced) {
          el.style.setProperty("--ry", `${(x - 0.5) * 8}deg`);
          el.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
        }
        el.dataset.hot = "1";
      }
      const m = reduced ? null : (e.target as HTMLElement).closest<HTMLElement>("[data-magnetic]");
      if (mag && mag !== m) mag.style.transform = "";
      mag = m;
      if (m) {
        const r = m.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        m.style.transform = `translate(${dx * 0.18}px, ${dy * 0.25}px)`;
      }
    };
    const reset = (el: HTMLElement) => {
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
      delete el.dataset.hot;
    };
    const onLeave = () => {
      if (active) reset(active);
      if (mag) mag.style.transform = "";
      active = mag = null;
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return null;
}

/** Interruptor del modo ligero: sin 3D ni animaciones de scroll (para móviles lentos o ahorro de datos). */
export function LiteToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(document.documentElement.dataset.lite === "1"), []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem("candu-lite", next ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
    if (next) document.documentElement.dataset.lite = "1";
    else delete document.documentElement.dataset.lite;
    window.location.reload();
  };
  return (
    <button type="button" className="toggle" aria-pressed={on} onClick={toggle}>
      <span className="toggle__track" aria-hidden />
      Modo ligero (sin 3D ni animaciones)
    </button>
  );
}

/**
 * Aviso informativo: la web solo usa almacenamiento técnico necesario, que no requiere consentimiento.
 * Si en el futuro se añaden cookies de analítica o publicidad, deberán cargarse solo tras aceptarlas.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem("candu-cookie-note") !== "1");
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="cookie-note on-dark" role="region" aria-label="Aviso de cookies">
      <p>
        Solo usamos almacenamiento técnico necesario (la cesta). Sin analítica ni publicidad.{" "}
        <a href="/cookies" style={{ color: "var(--oro)" }}>
          Más información
        </a>
      </p>
      <button
        type="button"
        className="btn btn--light"
        style={{ minHeight: 40, padding: "0 16px" }}
        onClick={() => {
          try {
            localStorage.setItem("candu-cookie-note", "1");
          } catch {
            /* sin almacenamiento */
          }
          setShow(false);
        }}
      >
        <span>Entendido</span>
      </button>
    </div>
  );
}
