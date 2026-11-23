import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { integrations, stripeMode, paypalMode, whatsappSendReady, baseUrl } from "@/lib/env";
import { recentLogs } from "@/lib/log";
import { dateTime } from "@/lib/format";
import { SettingsForm } from "@/components/admin/SettingsForm";
import type { OrderStatus } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";
import { LEGAL_CONFIG, isRequired, missingLegal } from "@/lib/legal";

const cents = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

const TITLES: Record<string, string> = {
  negocio: "Datos de Candú",
  entregas: "Entregas y localidades",
  pagos: "Pagos",
  catalogo: "Catálogo y filtros",
  estados: "Estados del pedido",
  galeria: "Galería del obrador",
  privacidad: "Privacidad y ubicación",
  "datos-legales": "Datos legales obligatorios",
  legal: "Textos legales",
  integraciones: "Conexiones",
  registro: "Registro de incidencias",
};

function F({ label, name, value, hint, type = "text", area = false, rows = 3 }: { label: string; name: string; value: string; hint?: string; type?: string; area?: boolean; rows?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      {area ? <textarea className="textarea" name={name} defaultValue={value} rows={rows} /> : <input className="input" name={name} defaultValue={value} type={type} />}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export default async function Section({ params }: { params: Promise<{ seccion: string }> }) {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const { seccion } = await params;
  if (!TITLES[seccion]) notFound();
  const s = await getSettings();

  let body: React.ReactNode = null;
  switch (seccion) {
    case "negocio": {
      const b = s.business;
      body = (
        <SettingsForm section="negocio">
          <div className="card stack">
            <F label="Nombre del negocio" name="name" value={b.name} />
            <F label="Nombre visible de la pastelera" name="displayName" value={b.displayName} hint="Se usa en la web (por defecto «Juani»)." />
            <F label="Lema" name="tagline" value={b.tagline} />
            <F label="Teléfono" name="phone" value={b.phone} />
            <F label="WhatsApp (con prefijo, sin +)" name="whatsapp" value={b.whatsapp} hint="Ejemplo: 34630758193" />
            <F label="Correo" name="email" value={b.email} type="email" />
            <F label="Dirección" name="address" value={b.address} />
            <F label="Código postal" name="postalCode" value={b.postalCode} />
            <F label="Instagram (usuario)" name="instagram" value={b.instagram} />
            <F label="Horario" name="hours" value={b.hours} hint="Déjalo vacío si no quieres publicarlo." />
            <p className="hint" style={{ margin: 0 }}>
              El titular, el NIF y el registro sanitario se configuran en <Link href="/admin/ajustes/datos-legales">Ajustes › Datos legales</Link>.
            </p>
          </div>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Historia</h2>
            <F label="Título" name="storyTitle" value={s.story.title} />
            <F label="Párrafos (separa con una línea en blanco)" name="storyParagraphs" value={s.story.paragraphs.join("\n\n")} area rows={8} />
            <F label="Cita" name="quote" value={s.story.quote} area rows={2} />
            <F label="Autora de la cita" name="quoteAuthor" value={s.story.quoteAuthor} />
          </div>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Postres para restaurantes</h2>
            {!s.restaurants.confirmed && <p className="notice notice--warn" style={{ margin: 0 }}>Este texto procede de una candidatura de Cruz Roja, no de la web de Candú. Confírmalo o desactívalo.</p>}
            <label className="check">
              <input type="checkbox" name="restEnabled" defaultChecked={s.restaurants.enabled} /> Mostrar en la web
            </label>
            <label className="check">
              <input type="checkbox" name="restConfirmed" defaultChecked={s.restaurants.confirmed} /> He revisado y confirmo este texto
            </label>
            <F label="Título" name="restTitle" value={s.restaurants.title} />
            <F label="Texto" name="restText" value={s.restaurants.text} area />
          </div>
        </SettingsForm>
      );
      break;
    }
    case "entregas": {
      const d = s.delivery;
      body = (
        <SettingsForm section="entregas">
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Recogida en el obrador</h2>
            <label className="check">
              <input type="checkbox" name="pickupEnabled" defaultChecked={d.pickup.enabled} /> Ofrecer recogida
            </label>
            <F label="Dirección de recogida" name="pickupAddress" value={d.pickup.address} />
            <F label="Notas (horario de recogida, cómo llegar…)" name="pickupNotes" value={d.pickup.notes} />
          </div>
          <div className="card">
            <h2 style={{ margin: 0 }}>Localidades de reparto</h2>
            <p className="hint">
              Solo se ofrecen en la web las que actives. Deja el coste vacío si aún no está decidido (se mostrará «a confirmar»); pon 0 si es gratis. Para quitar una localidad, borra su nombre.
            </p>
            {d.localities.map((l) => (
              <div className="loc-row" key={l.id}>
                <input type="hidden" name="locId" value={l.id} />
                <F label="Nombre" name="locName" value={l.name} />
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label className="check">
                    <input type="checkbox" name="locEnabled" value={l.id} defaultChecked={l.enabled} /> Activa
                  </label>
                  <label className="check">
                    <input type="checkbox" name="locConfirmed" value={l.id} defaultChecked={l.confirmed} /> Condiciones confirmadas
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <F label="Coste de entrega (€)" name="locFee" value={cents(l.feeCents)} />
                  <F label="Pedido mínimo (€)" name="locMin" value={cents(l.minOrderCents)} />
                </div>
                <F label="Notas para el cliente" name="locNotes" value={l.notes} />
                <details className="fold">
                  <summary>Ubicación aproximada (para ordenar el reparto)</summary>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <F label="Latitud" name="locLat" value={l.lat?.toString() ?? ""} />
                    <F label="Longitud" name="locLng" value={l.lng?.toString() ?? ""} />
                  </div>
                  <span className="hint">Centro aproximado de la localidad. Revísalo: se usa cuando no se puede localizar la dirección exacta.</span>
                </details>
              </div>
            ))}
            <div style={{ paddingTop: 14 }}>
              <F label="Añadir localidad" name="newLocality" value="" hint="Se añade desactivada para que revises sus condiciones." />
            </div>
          </div>
          <div className="card stack">
            <F label="Pedido mínimo general (€)" name="minOrder" value={cents(d.minOrderCents)} hint="Vacío = sin pedido mínimo." />
            <F label="Franjas de entrega (una por línea)" name="slots" value={d.slots.join("\n")} area rows={4} hint="Ejemplo: 10:00-13:00. Si lo dejas vacío, el cliente indica su preferencia y tú la confirmas." />
            <F label="Condiciones de entrega (se muestran al pedir)" name="conditions" value={d.conditions} area rows={4} />
            <details className="fold">
              <summary>Punto de salida del reparto</summary>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <F label="Latitud" name="originLat" value={d.origin.lat?.toString() ?? ""} />
                <F label="Longitud" name="originLng" value={d.origin.lng?.toString() ?? ""} />
              </div>
              <span className="hint">Opcional. Si compartes la ubicación al empezar el reparto, se usa tu posición real.</span>
            </details>
          </div>
        </SettingsForm>
      );
      break;
    }
    case "pagos": {
      const sm = stripeMode();
      const pm = paypalMode();
      body = (
        <SettingsForm section="pagos">
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Pago al recibir o recoger</h2>
            <label className="check">
              <input type="checkbox" name="codEnabled" defaultChecked={s.payments.codEnabled} /> Aceptar pago al recibir (contra reembolso)
            </label>
            <p className="hint" style={{ margin: 0 }}>Actívalo solo si lo confirmas. Los pedidos quedan como «pago al recibir» hasta que los marques entregados.</p>
            <F label="Nombre del método" name="codLabel" value={s.payments.codLabel} />
            <F label="Explicación para el cliente" name="codNote" value={s.payments.codNote} />
          </div>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Pago online</h2>
            <p style={{ margin: 0 }}>
              Stripe: <b>{sm === "live" ? "cobros reales" : sm === "test" ? "MODO PRUEBA" : "no conectado"}</b> · PayPal directo: <b>{pm === "live" ? "cobros reales" : pm === "test" ? "sandbox (prueba)" : "no conectado"}</b>
            </p>
            <p className="hint" style={{ margin: 0 }}>Las claves se configuran en el servidor (variables de entorno), nunca aquí. Ver Conexiones.</p>
            <F label="Nombre del pago con Stripe" name="stripeLabel" value={s.payments.stripeLabel} hint="Por ejemplo «Tarjeta o Bizum» si activas Bizum en Stripe." />
            <F label="Explicación" name="stripeNote" value={s.payments.stripeNote} />
          </div>
        </SettingsForm>
      );
      break;
    }
    case "catalogo":
      body = (
        <SettingsForm section="catalogo">
          <div className="card stack">
            <F label="Categorías (una por línea)" name="categories" value={s.catalog.categories.map((c) => c.name).join("\n")} area rows={5} hint="Por ejemplo: Tartas, Individuales, Bollería. Solo aparecen como filtro si tienen productos publicados." />
            <F label="Temporadas (una por línea)" name="seasons" value={s.catalog.seasons.map((c) => c.name).join("\n")} area rows={4} hint="Por ejemplo: Navidad, Primavera." />
            <F label="Título cuando no hay productos" name="emptyTitle" value={s.catalog.emptyTitle} />
            <F label="Texto cuando no hay productos" name="emptyText" value={s.catalog.emptyText} area rows={4} />
          </div>
        </SettingsForm>
      );
      break;
    case "estados":
      body = (
        <SettingsForm section="estados">
          <div className="card stack">
            {(Object.keys(s.statuses) as OrderStatus[]).map((k) => (
              <F key={k} label={k} name={k} value={s.statuses[k]} />
            ))}
          </div>
        </SettingsForm>
      );
      break;
    case "galeria":
      body = (
        <SettingsForm section="galeria">
          {s.gallery.map((g) => (
            <div className="card stack" key={g.src}>
              <img src={g.src} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} />
              <input type="hidden" name="gSrc" value={g.src} />
              <label className="check">
                <input type="checkbox" name="gVisible" value={g.src} defaultChecked={g.visible} /> Mostrar en la portada
              </label>
              <F label="Título corto" name="gCaption" value={g.caption} />
              <F label="Descripción para lectores de pantalla" name="gAlt" value={g.alt} area rows={2} />
            </div>
          ))}
        </SettingsForm>
      );
      break;
    case "privacidad":
      body = (
        <SettingsForm section="privacidad">
          <div className="card stack">
            <p style={{ margin: 0 }}>Solo se guarda la última posición del reparto activo (nunca el recorrido). Los clientes la ven únicamente mientras su pedido está pendiente en ese reparto.</p>
            <label className="field">
              <span>¿Cuándo se borra la ubicación?</span>
              <select className="select" name="locationRetention" defaultValue={s.privacy.locationRetention}>
                <option value="on_end">Al terminar el reparto (recomendado)</option>
                <option value="24h">24 horas después de terminar</option>
              </select>
            </label>
            <F label="Cerrar solo un reparto sin actualizaciones tras (horas)" name="staleRouteHours" value={String(s.privacy.staleRouteHours)} type="number" />
            <F label="Una posición deja de mostrarse como actual tras (segundos)" name="liveSeconds" value={String(s.privacy.liveSeconds)} type="number" />
            <p className="hint" style={{ margin: 0 }}>También puedes borrar ubicaciones antiguas con <code>npm run privacy:purge</code> o programarlo en el servidor.</p>
          </div>
        </SettingsForm>
      );
      break;
    case "datos-legales": {
      const v = s.legalInfo;
      const missing = missingLegal(v);
      body = (
        <SettingsForm section="datos-legales">
          <p className={`notice ${missing.length ? "notice--warn" : "notice--ok"}`}>
            {missing.length
              ? `Faltan ${missing.length} datos obligatorios: ${missing.map((m) => m.etiqueta.split(" (")[0]).join(", ")}. Mientras falten, la web muestra «[PENDIENTE]» en los textos legales.`
              : "Todos los datos obligatorios están completos. Recuerda revisar los textos legales con un profesional."}
          </p>
          <p className="meta" style={{ margin: 0 }}>
            Estos datos los exige la ley a cualquier web que vende a consumidores. Se rellenan solos en el aviso legal, la privacidad y las condiciones de compra. Lo marcado como «público» aparece en la web.
          </p>
          {LEGAL_CONFIG.grupos.map((g) => (
            <fieldset key={g.id} className="card stack" style={{ border: "1px solid var(--line)" }}>
              <legend style={{ fontWeight: 700, padding: "0 6px" }}>{g.titulo}</legend>
              {g.campos.map((f) => {
                const req = isRequired(f, v);
                const val = v[f.id];
                const help = (
                  <span className="hint">
                    {f.ayuda} <em>({f.ley}{f.publico ? " · público" : " · no se publica"})</em>
                  </span>
                );
                if (f.tipo === "casilla")
                  return (
                    <div key={f.id} className="field">
                      <label className="check">
                        <input type="checkbox" name={`lg_${f.id}`} defaultChecked={val === true} />
                        <span>
                          {f.etiqueta}
                          {req ? " *" : ""}
                        </span>
                      </label>
                      {help}
                    </div>
                  );
                if (f.tipo === "opciones")
                  return (
                    <label key={f.id} className="field">
                      <span>
                        {f.etiqueta}
                        {req ? " *" : ""}
                      </span>
                      <select className="select" name={`lg_${f.id}`} defaultValue={typeof val === "string" ? val : ""}>
                        <option value="">—</option>
                        {f.opciones?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      {help}
                    </label>
                  );
                return (
                  <label key={f.id} className="field">
                    <span>
                      {f.etiqueta}
                      {req ? " *" : ""}
                    </span>
                    <input
                      className="input"
                      name={`lg_${f.id}`}
                      type={f.tipo === "email" ? "email" : "text"}
                      defaultValue={typeof val === "string" ? val : ""}
                      autoComplete="off"
                      maxLength={400}
                    />
                    {help}
                  </label>
                );
              })}
            </fieldset>
          ))}
          <details className="fold">
            <summary>Otras obligaciones (ya resueltas en la web)</summary>
            <ul className="meta" style={{ paddingLeft: 18, margin: 0, display: "grid", gap: 6 }}>
              {LEGAL_CONFIG.notas.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
          <p className="hint" style={{ margin: 0 }}>Información orientativa revisada el 19/11/2026. No sustituye el asesoramiento de una gestoría o abogado.</p>
        </SettingsForm>
      );
      break;
    }
    case "legal":
      body = (
        <SettingsForm section="legal">
          <p className="notice notice--warn">Borradores orientativos. Deben revisarse por un profesional antes de publicar la web. Las marcas [PENDIENTE…] se resaltan en amarillo en la web. Los marcadores entre llaves dobles, como {"{{titular}}"} o {"{{nif}}"}, se sustituyen por lo que pongas en <Link href="/admin/ajustes/datos-legales">Datos legales</Link>.</p>
          <div className="card stack">
            <F label="Aviso legal" name="avisoLegal" value={s.legal.avisoLegal} area rows={10} />
            <F label="Política de privacidad" name="privacidad" value={s.legal.privacidad} area rows={12} />
            <F label="Política de cookies" name="cookies" value={s.legal.cookies} area rows={8} />
            <F label="Condiciones de compra" name="condiciones" value={s.legal.condiciones} area rows={10} />
            <label className="check">
              <input type="checkbox" name="reviewed" defaultChecked={s.legal.reviewed} /> Los textos han sido revisados (quita el aviso de borrador en la web)
            </label>
          </div>
        </SettingsForm>
      );
      break;
    case "integraciones": {
      const base = baseUrl();
      body = (
        <>
          <div className="card">
            {integrations().map((i) => (
              <div className="integration" key={i.id}>
                <span className={`state-dot state-${i.state}`} aria-hidden />
                <div>
                  <strong>{i.name}</strong>
                  <div className="meta">{i.summary}</div>
                  {i.manualSteps && <div className="meta">{i.manualSteps}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="card stack" style={{ marginTop: 12 }}>
            <h2 style={{ margin: 0 }}>Direcciones para configurar en cada servicio</h2>
            <p className="meta" style={{ margin: 0 }}>Solo funcionan cuando la web esté publicada con HTTPS en su dominio.</p>
            <code style={{ wordBreak: "break-all" }}>Webhook de Stripe: {base}/api/payments/stripe</code>
            <code style={{ wordBreak: "break-all" }}>Webhook de PayPal: {base}/api/payments/paypal</code>
            <code style={{ wordBreak: "break-all" }}>Webhook de WhatsApp: {base}/api/whatsapp</code>
            <p className="hint" style={{ margin: 0 }}>Avisos de pedido por WhatsApp: {whatsappSendReady() ? "automáticos" : "manuales (botón «Abrir WhatsApp»)"}. Guía completa en docs/INTEGRACIONES.md del proyecto.</p>
          </div>
          <p className="meta" style={{ marginTop: 12 }}>Verde: conectado · Amarillo: modo prueba · Azul: paso manual · Gris: sin configurar</p>
        </>
      );
      break;
    }
    case "registro": {
      const logs = await recentLogs(150);
      body = (
        <div className="card">
          {logs.length === 0 && <p style={{ margin: 0 }}>Sin incidencias registradas.</p>}
          {logs.map((l) => (
            <div key={l.id} className="log-item">
              <div className="row">
                <span className={`chip ${l.level === "error" ? "chip--err" : l.level === "warn" ? "chip--warn" : ""}`}>{l.source}</span>
                <span className="meta">{dateTime(l.createdAt)}</span>
              </div>
              <p style={{ margin: "6px 0 0" }}>{l.message}</p>
              {l.detail && (
                <details className="fold">
                  <summary>Detalle técnico</summary>
                  <code style={{ fontSize: ".8rem", wordBreak: "break-all" }}>{l.detail}</code>
                </details>
              )}
            </div>
          ))}
        </div>
      );
      break;
    }
  }

  return (
    <>
      <Link href="/admin/ajustes" className="meta">
        ← Ajustes
      </Link>
      <h1>{TITLES[seccion]}</h1>
      {body}
    </>
  );
}
