"use client";

import { useState } from "react";

interface M {
  id: string;
  kind: "image" | "video";
  url: string;
  thumb: string | null;
  alt: string;
}

export function ProductGallery({ media }: { media: M[] }) {
  const usable = media.filter((m) => m.url);
  const [i, setI] = useState(0);
  const cur = usable[i];
  return (
    <div className="pgallery">
      <div className="pgallery__main">
        {cur?.kind === "image" && <img key={cur.id} src={cur.url} alt={cur.alt} />}
        {cur?.kind === "video" && <video key={cur.id} src={cur.url} controls playsInline preload="metadata" aria-label={cur.alt} />}
      </div>
      {usable.length > 1 && (
        <div className="pgallery__thumbs" role="group" aria-label="Fotos y vídeos del producto">
          {usable.map((m, idx) => (
            <button key={m.id} type="button" aria-current={idx === i} aria-label={`Ver ${m.kind === "video" ? "vídeo" : "foto"} ${idx + 1}`} onClick={() => setI(idx)}>
              {m.kind === "image" ? <img src={m.thumb ?? m.url} alt="" /> : <video src={m.url} muted preload="metadata" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
