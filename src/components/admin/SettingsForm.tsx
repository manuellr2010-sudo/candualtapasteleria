"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SaveResult } from "@/app/admin/actions";

/** Formulario de ajustes con aviso de guardado. Los campos van como hijos. */
export function SettingsForm({ section, children }: { section: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<SaveResult | undefined, FormData>(
    (_prev, fd) => saveSettingsAction(section, fd),
    undefined,
  );
  return (
    <form action={action} className="stack">
      {children}
      <div className="sticky-bar">
        <button className="btn btn--cereza" disabled={pending}>
          <span>{pending ? "Guardando…" : "Guardar cambios"}</span>
        </button>
      </div>
      {state && (
        <p className={`notice ${state.ok ? "notice--ok" : "notice--err"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
