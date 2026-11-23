"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { euros } from "@/lib/format";
import type { PublicProduct } from "@/lib/public";
import { useCart } from "./CartProvider";
import { IconArrow, IconWhatsapp } from "./Icons";

interface Props {
  today: string;
  pickup: { enabled: boolean; address: string; notes: string };
  localities: { id: string; name: string; feeCents: number | null; minOrderCents: number | null; notes: string }[];
  slots: string[];
  minOrderCents: number | null;
  conditions: string;
  methods: { id: "stripe" | "paypal" | "cod"; label: string; note: string; test: boolean }[];
  whatsapp: string;
}

type Errors = Partial<Record<string, string>>;

export function CheckoutForm(p: Props) {
  const cart = useCart();
  const [fresh, setFresh] = useState<PublicProduct[] | null>(null);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">(p.pickup.enabled ? "pickup" : "delivery");
  const [localityId, setLocalityId] = useState(p.localities.length === 1 ? p.localities[0].id : "");
  const [method, setMethod] = useState(p.methods[0]?.id ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Revalida la cesta con los datos actuales del servidor (precio, disponibilidad, unidades).
  useEffect(() => {
    if (!cart.ready) return;
    const ids = cart.items.map((i) => i.productId);
    if (!ids.length) {
      setFresh([]);
      return;
    }
    fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
      .then((r) => r.json())
      .then((d: { products: PublicProduct[] }) => {
        setFresh(d.products);
        for (const it of cart.items) {
          const fp = d.products.find((x) => x.id === it.productId);
          if (!fp || !fp.availability.buyable) {
            cart.remove(it.productId);
            cart.notify(`«${it.title}» ya no está disponible y se ha quitado de la cesta`);
          } else if (fp.unitsAvailable !== null && it.qty > fp.unitsAvailable) {
            cart.setQty(it.productId, fp.unitsAvailable);
            cart.notify(`Solo quedan ${fp.unitsAvailable} de «${it.title}»`);
          }
        }
      })
      .catch(() => setFresh(null));
    // Solo al cargar la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);

  const lines = useMemo(
    () =>
      cart.items
        .map((it) => {
          const fp = fresh?.find((x) => x.id === it.productId);
          return { ...it, priceCents: fp?.priceCents ?? it.priceCents, fp };
        })
        .filter((l) => !fresh || l.fp),
    [cart.items, fresh],
  );

  const subtotal = lines.reduce((a, l) => a + l.priceCents * l.qty, 0);
  const loc = p.localities.find((l) => l.id === localityId);
  const fee = deliveryType === "delivery" ? (loc?.feeCents ?? null) : 0;
  const total = subtotal + (fee ?? 0);
  const minOrder = Math.max(p.minOrderCents ?? 0, deliveryType === "delivery" ? (loc?.minOrderCents ?? 0) : 0) || null;

  // Fechas posibles: intersección de las ventanas de entrega de los productos.
  const minDate = [p.today, ...lines.map((l) => l.fp?.deliveryFrom).filter((d): d is string => Boolean(d))].sort().at(-1)!;
  const maxDates = lines.map((l) => l.fp?.deliveryTo).filter((d): d is string => Boolean(d)).sort();
  const maxDate = maxDates[0] ?? undefined;
  const noCommonDate = Boolean(maxDate && maxDate < minDate);

  const selected = p.methods.find((m) => m.id === method);
  const canDeliver = p.pickup.enabled || p.localities.length > 0;

  if (!cart.ready || (cart.items.length > 0 && fresh === null)) return <p className="muted">Comprobando tu cesta…</p>;

  if (!lines.length) {
    return (
      <div className="empty">
        <h3>Tu cesta está vacía</h3>
        <p>Echa un vistazo a lo que hay esta temporada.</p>
        <Link href="/#temporada" className="btn">
          <span>Ver catálogo</span>
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          name: fd.get("name"),
          phone: fd.get("phone"),
          deliveryType,
          address: fd.get("address") ?? "",
          localityId: deliveryType === "delivery" ? localityId : "",
          date: fd.get("date"),
          slot: fd.get("slot") ?? "",
          notes: fd.get("notes") ?? "",
          paymentMethod: method,
          acceptTerms: fd.get("acceptTerms") === "on",
          whatsappConsent: fd.get("whatsappConsent") === "on",
        }),
      });
      const data = (await res.json()) as { redirect?: string; error?: string; fieldErrors?: Errors };
      if (!res.ok || !data.redirect) {
        setErrors(data.fieldErrors ?? {});
        setFormError(data.error ?? "No se pudo enviar el pedido. Inténtalo de nuevo.");
        setBusy(false);
        document.getElementById("form-error")?.focus();
        return;
      }
      cart.clear();
      window.location.assign(data.redirect);
    } catch {
      setFormError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <span className="field-error" id={`${k}-err`}>
        {errors[k]}
      </span>
    ) : null;

  const blocked = !canDeliver || p.methods.length === 0 || noCommonDate;

  return (
    <form className="checkout" onSubmit={submit} noValidate>
      <div>
        {!canDeliver && (
          <p className="notice notice--warn" style={{ marginBottom: 24 }}>
            Candú todavía está configurando las entregas y aún no acepta pedidos desde la web.{" "}
            <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noopener noreferrer">
              Escríbenos por WhatsApp
            </a>{" "}
            para encargar.
          </p>
        )}
        {canDeliver && p.methods.length === 0 && (
          <p className="notice notice--warn" style={{ marginBottom: 24 }}>
            Los pagos desde la web aún no están activos.{" "}
            <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noopener noreferrer">
              Escríbenos por WhatsApp
            </a>{" "}
            y te ayudamos con tu pedido.
          </p>
        )}
        {formError && (
          <p className="notice notice--err" id="form-error" tabIndex={-1} role="alert" style={{ marginBottom: 24 }}>
            {formError}
          </p>
        )}

        <fieldset className="fieldset" disabled={blocked}>
          <legend>
            <i>i.</i> Tus datos
          </legend>
          <div className="two">
            <label className="field">
              <span>Nombre</span>
              <input className="input" name="name" autoComplete="name" required maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-err" : undefined} />
              {err("name")}
            </label>
            <label className="field">
              <span>Teléfono</span>
              <input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-err" : "phone-hint"} />
              {err("phone") ?? <span className="hint" id="phone-hint">Para avisarte si hay cualquier cambio con tu pedido.</span>}
            </label>
          </div>
        </fieldset>

        <fieldset className="fieldset" disabled={blocked}>
          <legend>
            <i>ii.</i> Entrega
          </legend>
          <div className="choice-grid choice-grid--2" role="radiogroup" aria-label="Modalidad de entrega">
            {p.pickup.enabled && (
              <label className="choice">
                <input type="radio" name="deliveryType" checked={deliveryType === "pickup"} onChange={() => setDeliveryType("pickup")} />
                <strong>Recoger en el obrador</strong>
                <small>{p.pickup.address || "Las Cucharetas, Cortes de Baza"}{p.pickup.notes ? ` · ${p.pickup.notes}` : ""}</small>
              </label>
            )}
            {p.localities.length > 0 && (
              <label className="choice">
                <input type="radio" name="deliveryType" checked={deliveryType === "delivery"} onChange={() => setDeliveryType("delivery")} />
                <strong>Reparto a domicilio</strong>
                <small>{p.localities.map((l) => l.name).join(", ")}</small>
              </label>
            )}
          </div>
          {deliveryType === "delivery" && (
            <>
              <label className="field">
                <span>Localidad</span>
                <select className="select" value={localityId} onChange={(e) => setLocalityId(e.target.value)} aria-invalid={Boolean(errors.localityId)}>
                  <option value="">Elige tu localidad</option>
                  {p.localities.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.feeCents !== null ? ` · ${l.feeCents === 0 ? "sin coste" : euros(l.feeCents)}` : ""}
                    </option>
                  ))}
                </select>
                {err("localityId")}
                {loc?.notes && <span className="hint">{loc.notes}</span>}
              </label>
              <label className="field">
                <span>Dirección de entrega</span>
                <input className="input" name="address" autoComplete="street-address" maxLength={200} aria-invalid={Boolean(errors.address)} placeholder="Calle, número, piso…" />
                {err("address")}
              </label>
            </>
          )}
          {p.conditions && <p className="hint" style={{ whiteSpace: "pre-line" }}>{p.conditions}</p>}
        </fieldset>

        <fieldset className="fieldset" disabled={blocked}>
          <legend>
            <i>iii.</i> Fecha
          </legend>
          {noCommonDate && <p className="notice notice--warn">Los productos de tu cesta no tienen fechas de entrega en común. Haz pedidos separados o quita alguno.</p>}
          <div className="two">
            <label className="field">
              <span>Fecha</span>
              <input className="input" type="date" name="date" min={minDate} max={maxDate} defaultValue={minDate} required aria-invalid={Boolean(errors.date)} />
              {err("date")}
            </label>
            <label className="field">
              <span>{p.slots.length ? "Franja" : "Franja preferida (opcional)"}</span>
              {p.slots.length ? (
                <select className="select" name="slot" required aria-invalid={Boolean(errors.slot)}>
                  {p.slots.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <input className="input" name="slot" maxLength={60} placeholder="Ej.: por la tarde" />
              )}
              {err("slot") ?? (!p.slots.length && <span className="hint">Candú te confirmará la hora.</span>)}
            </label>
          </div>
          <label className="field">
            <span>Notas para la entrega (opcional)</span>
            <textarea className="textarea" name="notes" maxLength={500} placeholder="Solo lo necesario para entregar: timbre, referencia…" />
          </label>
        </fieldset>

        <fieldset className="fieldset" disabled={blocked}>
          <legend>
            <i>iv.</i> Pago
          </legend>
          {p.methods.length > 0 && (
            <div className="choice-grid" role="radiogroup" aria-label="Método de pago">
              {p.methods.map((m) => (
                <label className="choice" key={m.id}>
                  <input type="radio" name="paymentMethod" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <strong>
                    {m.label} {m.test && <span className="chip chip--test">MODO PRUEBA</span>}
                  </strong>
                  <small>{m.note}</small>
                </label>
              ))}
            </div>
          )}
          {selected?.test && (
            <p className="notice notice--test">
              <strong>Modo prueba:</strong> este método está conectado a una cuenta de pruebas. No se cobrará dinero real y el pedido quedará marcado como prueba.
            </p>
          )}
          <label className="check">
            <input type="checkbox" name="acceptTerms" required aria-invalid={Boolean(errors.acceptTerms)} />
            <span>
              Acepto las{" "}
              <a href="/condiciones" target="_blank">
                condiciones de compra
              </a>{" "}
              y la{" "}
              <a href="/privacidad" target="_blank">
                política de privacidad
              </a>
              .
            </span>
          </label>
          {err("acceptTerms")}
          <label className="check">
            <input type="checkbox" name="whatsappConsent" />
            <span>Quiero recibir avisos del estado de mi pedido por WhatsApp (opcional).</span>
          </label>
        </fieldset>
      </div>

      <aside className="checkout__summary" aria-label="Resumen del pedido">
        <div className="summary-card">
          <h2>Resumen</h2>
          {lines.map((l) => (
            <div className="summary-line" key={l.productId}>
              <span>
                {l.qty} × {l.title}
              </span>
              <span>{euros(l.priceCents * l.qty)}</span>
            </div>
          ))}
          <div className="summary-line" style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 14 }}>
            <span>Entrega</span>
            <span>{deliveryType === "pickup" ? "Recogida" : fee === null ? (loc ? "A confirmar (no incluido)" : "—") : fee === 0 ? "Sin coste" : euros(fee)}</span>
          </div>
          <div className="totals" style={{ marginTop: 10 }}>
            <span>Total</span>
            <strong>{euros(total)}</strong>
          </div>
          {minOrder !== null && subtotal < minOrder && <p className="notice notice--warn" style={{ marginTop: 14 }}>El pedido mínimo es {euros(minOrder)}.</p>}
          <button className="btn btn--cereza btn--lg btn--block" style={{ marginTop: 18 }} type="submit" disabled={busy || blocked || (minOrder !== null && subtotal < minOrder)}>
            <span>{busy ? "Enviando…" : method === "cod" ? "Confirmar pedido" : "Ir al pago seguro"}</span> {!busy && <IconArrow />}
          </button>
          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            {method === "cod" ? "Pagas al recibir o recoger. Candú confirmará tu pedido." : "Te llevaremos a la página segura del proveedor de pago. La web no guarda los datos de tu tarjeta."}
          </p>
          <a className="btn btn--ghost btn--block" style={{ marginTop: 14 }} href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noopener noreferrer">
            <IconWhatsapp /> <span>¿Dudas? WhatsApp</span>
          </a>
        </div>
      </aside>
    </form>
  );
}
