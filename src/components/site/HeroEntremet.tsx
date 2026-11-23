"use client";

import { useEffect, useRef, useState } from "react";
import { isLite, motionReduced } from "@/lib/motion";
import type { SceneHandle } from "./entremet-scene";
import { MotionToggle } from "./SiteChrome";

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Nombres de técnica de las capas de la pieza ilustrativa (de abajo arriba). No describen un producto a la venta. */
const LAYERS = ["Base crujiente", "Bizcocho", "Inserto de fruta", "Mousse", "Glaseado espejo"];

/**
 * Pieza 3D del hero. Siempre es interactiva: se gira arrastrando y se abre con el botón.
 * Con animaciones completas, además se separa en capas al hacer scroll y flota suavemente.
 * Con movimiento reducido no se mueve sola. En modo ligero o sin WebGL se muestra la foto real.
 */
export function HeroEntremet({ fallbackSrc, fallbackAlt }: { fallbackSrc: string; fallbackAlt: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [reducedNow, setReducedNow] = useState(false);

  useEffect(() => {
    setReducedNow(motionReduced());
    if (isLite() || !webglOk()) {
      setMode("static");
      return;
    }
    const reduced = motionReduced();
    let cancelled = false;
    import("./entremet-scene")
      .then(({ createScene }) => {
        if (cancelled || !stage.current) return;
        handle.current = createScene(stage.current, {
          reduced,
          labels: Array.from(labelsRef.current?.children ?? []) as HTMLElement[],
          onInteract: () => setTouched(true),
          onFail: () => {
            handle.current?.dispose();
            handle.current = null;
            delete stage.current?.closest("section")?.dataset.tall;
            setMode("static");
          },
        });
        setMode("3d");
        const section = stage.current.closest("section");
        if (section && !reduced) section.dataset.tall = "1";
      })
      .catch(() => setMode("static"));
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    handle.current?.setOpen(next);
  };

  return (
    <>
      <div className="hero__stage" ref={stage} data-mode={mode} aria-hidden={mode !== "static"}>
        <div className="layer-labels" ref={labelsRef} aria-hidden>
          {LAYERS.map((l) => (
            <span key={l} className="layer-label">
              {l}
            </span>
          ))}
        </div>
        {mode === "static" && (
          <div className="hero__fallback">
            <img src={fallbackSrc} alt={fallbackAlt} />
          </div>
        )}
      </div>
      {mode !== "pending" && (
        <div className="hero__piece-ui">
          {mode === "3d" && (
            <>
              <button type="button" className="piece-btn" aria-pressed={open} onClick={toggle} data-magnetic>
                <span className="piece-btn__icon" aria-hidden />
                {open ? "Montar la pieza" : "Ver las capas"}
              </button>
              <span className="piece-hint" data-hidden={touched ? "1" : "0"} aria-hidden>
                ↔ Arrastra para girarla · Ilustración 3D
              </span>
            </>
          )}
          {reducedNow && <MotionToggle variant="inline" />}
        </div>
      )}
    </>
  );
}
