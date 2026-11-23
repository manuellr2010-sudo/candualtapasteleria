import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import { PRODUCT_TEMPLATES } from "@/lib/templates";
import { ProductView } from "@/components/site/ProductView";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Vista previa del producto" };

/** Vista previa de la ficha tal como se verá en la web (con lo último que se guardó). No permite comprar. */
export default async function ProductPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const { id } = await params;
  const [p, s] = await Promise.all([getProduct(id), getSettings()]);
  if (!p) notFound();
  const tpl = PRODUCT_TEMPLATES.find((t) => t.id === p.template) ?? PRODUCT_TEMPLATES[0];
  return (
    <>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link href={`/admin/productos/${p.id}`} className="btn btn--ghost btn--sm">
          <span>← Volver a editar</span>
        </Link>
        <span className="chip chip--warn">Vista previa · {p.status === "published" ? "publicado" : "no visible para clientes"}</span>
        <span className="chip">Plantilla: {tpl.name}</span>
      </div>
      <p className="meta" style={{ margin: "8px 0 0" }}>
        Muestra lo último que guardaste. Si has cambiado algo, pulsa «Guardar» en el editor y vuelve aquí.
      </p>
      <div className="preview-frame site-preview">
        <ProductView
          p={p}
          preview
          whatsapp={s.business.whatsapp}
          seasonName={s.catalog.seasons.find((x) => x.id === p.seasonId)?.name}
          categoryName={s.catalog.categories.find((c) => c.id === p.categoryId)?.name}
        />
      </div>
    </>
  );
}
