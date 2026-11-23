import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { requireAdmin } from "@/lib/auth";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  await requireAdmin(); // comprobación también en cada página (los layouts no siempre se vuelven a ejecutar)
  const { id } = await params;
  const [p, s] = await Promise.all([getProduct(id), getSettings()]);
  if (!p) notFound();
  const isNew = Boolean((await searchParams).nuevo);
  return (
    <>
      <Link href="/admin/productos" className="meta">
        ← Productos
      </Link>
      <h1>{p.title || "Nuevo borrador"}</h1>
      {isNew && (
        <p className="notice notice--ok">
          Borrador creado con tus archivos. Escribe el título y el precio, revisa la descripción sugerida y pulsa <b>Publicar</b> cuando esté listo.
        </p>
      )}
      {p.status === "published" && (
        <p className="meta">
          Visible en la web:{" "}
          <a href={`/producto/${p.slug}`} target="_blank" rel="noopener">
            /producto/{p.slug}
          </a>
        </p>
      )}
      <ProductEditor product={p} categories={s.catalog.categories} seasons={s.catalog.seasons} />
    </>
  );
}
