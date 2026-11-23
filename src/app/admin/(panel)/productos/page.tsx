import Link from "next/link";
import { listProducts } from "@/lib/products";
import { availability } from "@/lib/availability";
import { euros, dateShort } from "@/lib/format";
import { whatsappInboxReady } from "@/lib/env";
import { Uploader } from "@/components/admin/Uploader";
import { newEmptyDraftAction } from "../../actions";
import type { ProductStatus } from "@/lib/types";
import { requireAdmin } from "@/lib/auth";

const TABS: { key: ProductStatus; label: string }[] = [
  { key: "draft", label: "Borradores" },
  { key: "published", label: "Publicados" },
  { key: "archived", label: "Archivo" },
];

export default async function Products({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const f = (await searchParams).f as ProductStatus | undefined;
  const tab = TABS.some((t) => t.key === f) ? f! : "draft";
  const all = await listProducts();
  const list = all.filter((p) => p.status === tab);
  const count = (k: ProductStatus) => all.filter((p) => p.status === k).length;

  return (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <h1>Productos</h1>
        <Link href="/admin/plantillas" className="btn btn--ghost btn--sm">
          <span>Ver las 5 plantillas</span>
        </Link>
      </div>

      <section id="subir" className="card stack" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Subir contenido</h2>
        <p className="meta" style={{ margin: 0 }}>
          Sube las fotos o vídeos (también los que preparaste para un Estado de WhatsApp). Se crea un <b>borrador</b>: nada aparece en la web hasta que pulses «Publicar».
        </p>
        <Uploader />
        <details className="fold">
          <summary>Otras formas de añadir contenido</summary>
          <ul className="meta" style={{ paddingLeft: 18, margin: 0, display: "grid", gap: 6 }}>
            <li>
              <b>Compartir desde el móvil (Android):</b> instala esta web en la pantalla de inicio (menú del navegador › «Instalar» o «Añadir a pantalla de inicio»). Después, en la galería o en WhatsApp, pulsa «Compartir» y elige «Candú».
            </li>
            <li>
              <b>Reenviar por WhatsApp:</b>{" "}
              {whatsappInboxReady()
                ? "conectado. Las fotos que envíes al número de la tienda desde tu móvil autorizado crean un borrador."
                : "aún no conectado. Requiere la API oficial de WhatsApp Business (ver Ajustes › Conexiones)."}
            </li>
            <li>
              <b>Estados de WhatsApp:</b> ninguna herramienta oficial permite leerlos automáticamente. Usa los mismos archivos del Estado y súbelos aquí.
            </li>
          </ul>
        </details>
        <form action={newEmptyDraftAction}>
          <button className="btn btn--ghost btn--sm">
            <span>Crear producto sin fotos</span>
          </button>
        </form>
      </section>

      <nav className="tabs" aria-label="Estado de los productos">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/productos?f=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>
            {t.label} <span className="meta">{count(t.key)}</span>
          </Link>
        ))}
      </nav>

      {list.length === 0 && <p className="card">{tab === "draft" ? "No hay borradores. Sube fotos para crear uno." : tab === "published" ? "No hay productos publicados: la web muestra el mensaje de catálogo de temporada." : "El archivo está vacío."}</p>}
      {list.map((p) => {
        const a = availability(p);
        const img = p.media.find((m) => m.kind === "image");
        return (
          <Link key={p.id} href={`/admin/productos/${p.id}`} className="card card-link">
            <div className="row" style={{ justifyContent: "flex-start" }}>
              {img?.thumbUrl ? <img className="list-thumb" src={img.thumbUrl} alt="" /> : <div className="list-thumb" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: "1.05rem" }}>{p.title || "Sin título"}</strong>
                <span className="meta">
                  {euros(p.priceCents)}
                  {p.unitsAvailable !== null ? ` · ${p.unitsAvailable} uds.` : ""}
                  {p.orderDeadline ? ` · hasta ${dateShort(p.orderDeadline)}` : ""}
                </span>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {p.status === "published" && <span className={`chip ${a.buyable ? "chip--ok" : "chip--err"}`}>{a.label}</span>}
                  {p.source === "whatsapp" && <span className="chip">Desde WhatsApp</span>}
                  {p.status === "draft" && <span className="chip chip--warn">Sin publicar</span>}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </>
  );
}
