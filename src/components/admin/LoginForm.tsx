"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm({ configured, reason }: { configured: boolean; reason?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action}>
      <div>
        <span className="eyebrow" style={{ color: "var(--cereza)" }}>
          Panel privado
        </span>
        <h1 style={{ fontSize: "2.2rem", margin: "8px 0 0" }}>Candú</h1>
      </div>
      {!configured ? (
        <div className="notice notice--warn">
          <strong>El acceso aún no está configurado.</strong>
          <br />
          {reason} En el servidor, ejecuta <code>npm run admin:password</code> y reinicia la web. No existe ninguna contraseña por defecto.
        </div>
      ) : (
        <>
          <label className="field">
            <span>Contraseña</span>
            <input className="input" type="password" name="password" autoComplete="current-password" required autoFocus />
          </label>
          {state?.error && (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {state.error}
            </p>
          )}
          <button className="btn btn--cereza btn--lg btn--block" disabled={pending}>
            <span>{pending ? "Entrando…" : "Entrar"}</span>
          </button>
        </>
      )}
      <a href="/" className="hint" style={{ textAlign: "center" }}>
        Volver a la web
      </a>
    </form>
  );
}
