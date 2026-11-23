import "server-only";
import { availability } from "./availability";
import { expireStalePayments } from "./orders";
import { getProductsByIds, listPublished } from "./products";
import type { PublicProduct } from "./public";
import type { Product } from "./types";

export function toPublic(p: Product): PublicProduct {
  const images = p.media.filter((m) => m.kind === "image" && m.url);
  const video = p.media.find((m) => m.kind === "video" && m.url);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    priceCents: p.priceCents,
    image: images[0]?.thumbUrl ?? images[0]?.url ?? null,
    imageAlt: images[0]?.alt || p.title,
    imageLarge: images[0]?.url ?? null,
    image2: images[1]?.thumbUrl ?? null,
    video: video?.url ?? null,
    categoryId: p.categoryId,
    seasonId: p.seasonId,
    availability: availability(p),
    orderDeadline: p.orderDeadline,
    deliveryFrom: p.deliveryFrom,
    deliveryTo: p.deliveryTo,
    unitsAvailable: p.unitsAvailable,
  };
}

export async function publicCatalog(): Promise<PublicProduct[]> {
  await expireStalePayments(); // libera unidades de pagos abandonados antes de mostrar stock
  return (await listPublished()).map(toPublic);
}

export async function publicProductsByIds(ids: string[]): Promise<PublicProduct[]> {
  return (await getProductsByIds(ids)).filter((p) => p.status === "published").map(toPublic);
}
