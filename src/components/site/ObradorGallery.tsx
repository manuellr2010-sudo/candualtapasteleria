"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Plate {
  src: string;
  alt: string;
  caption: string;
}

/**
 * Galería del obrador: se arrastra con el ratón o el dedo, tiene flechas y barra de progreso,
 * y cada foto se abre a pantalla completa con lupa para ver los primeros planos.
 * Con animaciones completas en escritorio, el desplazamiento lo controla el scroll (HomeMotion).
 */
export function ObradorGallery({ plates }: { plates: Plate[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  const onScroll = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const max = t.scrollWidth - t.clientWidth;
    const p = max > 0 ? t.scrollLeft / max : 0;
    setProgress(p);
    setIndex(Math.round(p * (plates.length - 1)));
  }, [plates.length]);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    t.addEventListener("scroll", onScroll, { passive: true });
    return () => t.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const pinned = () => track.current?.dataset.pinned === "1";

  const go = (dir: 1 | -1) => {
    const t = track.current;
    if (!t || pinned()) return;
    const plate = t.querySelector<HTMLElement>(".plate");
    t.scrollBy({ left: dir * ((plate?.offsetWidth ?? 400) + 24), behavior: document.documentElement.dataset.motion === "reduced" ? "auto" : "smooth" });
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned() || !track.current) return;
    drag.current = { down: true, x: e.clientX, left: track.current.scrollLeft, moved: false };
    track.current.dataset.dragging = "1";
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.down || !track.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    track.current.scrollLeft = d.left - dx;
  };
  const onUp = () => {
    drag.current.down = false;
    if (track.current) delete track.current.dataset.dragging;
  };

  return (
    <>
      <div className="obrador__viewport">
        <div
          className="obrador__track"
          ref={track}
          tabIndex={0}
          aria-label="Galería de fotografías del obrador (desplázate horizontalmente)"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
        >
          {plates.map((g, i) => (
            <figure className={`plate${i % 3 === 2 ? " plate--tall" : ""}`} key={g.src}>
              <button
                type="button"
                className="plate__img"
                data-tilt
                aria-label={`Ampliar foto: ${g.caption}`}
                onClick={(e) => {
                  if (drag.current.moved) {
                    e.preventDefault();
                    drag.current.moved = false;
                    return;
                  }
                  setOpen(i);
                }}
              >
                <img src={g.src} alt={g.alt} loading="lazy" decoding="async" draggable={false} />
                <span className="plate__zoom" aria-hidden>
                  ⤢ Ver de cerca
                </span>
              </button>
              <figcaption>
                <b>{g.caption}</b>
                <span>
                  {String(i + 1).padStart(2, "0")} / {String(plates.length).padStart(2, "0")}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="wrap gallery-controls">
        <div className="gallery-progress" aria-hidden>
          <i style={{ transform: `scaleX(${Math.max(0.06, progress)})` }} />
        </div>
        <span className="gallery-count" aria-live="polite">
          {String(index + 1).padStart(2, "0")} / {String(plates.length).padStart(2, "0")}
        </span>
        <button type="button" className="round-btn" onClick={() => go(-1)} aria-label="Foto anterior">
          ←
        </button>
        <button type="button" className="round-btn" onClick={() => go(1)} aria-label="Foto siguiente">
          →
        </button>
      </div>
      {open !== null && <Lightbox plates={plates} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ plates, index, onIndex, onClose }: { plates: Plate[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(false);
  const p = plates[index];
  const prev = () => onIndex((index - 1 + plates.length) % plates.length);
  const next = () => onIndex((index + 1) % plates.length);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const moveLens = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoom) return;
    const stage = e.currentTarget.getBoundingClientRect();
    const img = e.currentTarget.querySelector("img")?.getBoundingClientRect() ?? stage;
    const fx = Math.min(1, Math.max(0, (e.clientX - img.left) / img.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - img.top) / img.height));
    setLens({ x: fx * 100, y: fy * 100, left: img.left - stage.left + fx * img.width, top: img.top - stage.top + fy * img.height });
  };

  return (
    <div className="lightbox on-dark" role="dialog" aria-modal="true" aria-label={`Foto: ${p.caption}`} ref={box} tabIndex={-1}>
      <div className="lightbox__bar">
        <span>
          {String(index + 1).padStart(2, "0")} / {String(plates.length).padStart(2, "0")} · <b>{p.caption}</b>
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="round-btn round-btn--light" aria-pressed={zoom} onClick={() => setZoom((z) => !z)} aria-label={zoom ? "Desactivar lupa" : "Activar lupa"}>
            🔍
          </button>
          <button type="button" className="round-btn round-btn--light" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
      </div>
      <div
        className="lightbox__stage"
        data-zoom={zoom ? "1" : "0"}
        onPointerMove={moveLens}
        onPointerDown={moveLens}
        onPointerLeave={() => setLens(null)}
        onClick={() => !zoom && setZoom(true)}
      >
        <img src={p.src} alt={p.alt} />
        {zoom && lens && (
          <span
            className="lens"
            aria-hidden
            style={{ left: lens.left, top: lens.top, backgroundImage: `url(${p.src})`, backgroundPosition: `${lens.x}% ${lens.y}%` }}
          />
        )}
      </div>
      <p className="lightbox__alt">{p.alt}</p>
      <div className="lightbox__nav">
        <button type="button" className="round-btn round-btn--light" onClick={prev} aria-label="Foto anterior">
          ←
        </button>
        <span className="hint" style={{ color: "rgba(244,237,226,.7)" }}>
          {zoom ? "Mueve el dedo o el ratón para ver los detalles" : "Toca la foto para usar la lupa"}
        </span>
        <button type="button" className="round-btn round-btn--light" onClick={next} aria-label="Foto siguiente">
          →
        </button>
      </div>
    </div>
  );
}
