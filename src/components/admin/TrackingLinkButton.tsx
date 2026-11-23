"use client";

import { useState, useTransition } from "react";
import { regenerateTrackingAction } from "@/app/admin/actions";
import { waLink } from "@/lib/format";

/** Genera un enlace privado de seguimiento nuevo para enviarlo al cliente. */
export function TrackingLinkButton({ orderId, customerWa, number }: { orderId: string; customerWa: string; number: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (url) {
    return (
      <div className="notice notice--ok stack" style={{ gap: 8 }}>
        <strong>Enlace nuevo creado</strong>
        <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de seguimiento" />
        <div className="actions">
          <a className="btn btn--sm" href={waLink(customerWa, `Puedes seguir tu pedido ${number} de Candú aquí: ${url}`)} target="_blank" rel="noopener noreferrer">
            <span>Enviarlo por WhatsApp</span>
          </a>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigator.clipboard?.writeText(url)}>
            <span>Copiar</span>
          </button>
        </div>
        <span className="hint">El enlace anterior ya no funciona. Este solo se muestra ahora.</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="btn btn--ghost"
      disabled={pending}
      onClick={() => confirm("Se creará un enlace nuevo y el anterior dejará de funcionar. ¿Continuar?") && start(async () => setUrl(await regenerateTrackingAction(orderId)))}
    >
      <span>Enlace de seguimiento para el cliente</span>
    </button>
  );
}
