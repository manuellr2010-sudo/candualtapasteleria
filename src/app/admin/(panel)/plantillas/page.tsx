import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { PRODUCT_TEMPLATES } from "@/lib/templates";
import { ProductView, type ProductViewData } from "@/components/site/ProductView";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Plantillas de producto" };

/**
 * Muestrario de las cinco plantillas para que Juani elija. Usa fotos reales del obrador y
 * textos de ejemplo entre corchetes: NO es un producto, no tiene precio ni datos inventados.
 */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const s = await getSettings();
  const { t } = await searchParams;
  const current = PRODUCT_TEMPLATES.find((x) => x.id === t) ?? PRODUCT_TEMPLATES[0];
  const photos = s.gallery.filter((g) => g.visible && !g.src.endsWith("candu-8.jpg")).slice(0, 4);
  const sample: ProductViewData = {
    id: "muestra",
    slug: "muestra",
    title: "[Título del producto]",
    tagline: "[Frase corta opcional]",
    description:
      "[Aquí va la descripción que escribas: cómo es la pieza, para cuántas personas, cómo conservarla…]\n\n[Las fotos son trabajos reales de Candú usados solo para enseñar el diseño.]",
    priceCents: null,
    status: "published",
    soldOut: false,
    unitsAvailable: null,
    orderDeadline: null,
    deliveryFrom: null,
    deliveryTo: null,
    deliverySlot: "[Franja de entrega, si la indicas]",
    deliveryNote: "",
    allergens: null,
    allergenNotes: "",
    template: current.id,
    media: photos.map((g, i) => ({ id: `g${i}`, kind: "image" as const, url: g.src, thumbUrl: g.src, alt: g.alt })),
  };
  return (
    <>
      <Link href="/admin/productos" className="meta">
        ← Productos
      </Link>
      <h1>Plantillas de producto</h1>
      <p className="meta">Cada producto puede usar una. Se elige en el editor del producto, apartado «Diseño de la ficha». Esto es solo un muestrario: no es un producto.</p>
      <div className="tpl-tabs" role="tablist" aria-label="Plantillas">
        {PRODUCT_TEMPLATES.map((x) => (
          <Link key={x.id} href={`/admin/plantillas?t=${x.id}`} role="tab" aria-selected={x.id === current.id} className="tpl-tab">
            <strong>{x.name}</strong>
            <span>{x.summary}</span>
          </Link>
        ))}
      </div>
      <div className="preview-frame site-preview">
        <ProductView p={sample} preview whatsapp={s.business.whatsapp} template={current.id} />
      </div>
    </>
  );
}
