import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedBySlug } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import { ProductView } from "@/components/site/ProductView";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await getPublishedBySlug((await params).slug);
  if (!p) return { title: "Producto no disponible" };
  const img = p.media.find((m) => m.kind === "image")?.url;
  return { title: p.title, description: p.description.slice(0, 160), openGraph: img ? { images: [img] } : undefined };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const [p, s] = await Promise.all([getPublishedBySlug(slug), getSettings()]);
  if (!p) notFound();
  return (
    <ProductView
      p={p}
      whatsapp={s.business.whatsapp}
      seasonName={s.catalog.seasons.find((x) => x.id === p.seasonId)?.name}
      categoryName={s.catalog.categories.find((c) => c.id === p.categoryId)?.name}
    />
  );
}
