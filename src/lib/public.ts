import type { Availability } from "./availability";

/** Datos de producto que se envían al navegador (sin campos internos). */
export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  priceCents: number | null;
  image: string | null;
  imageAlt: string;
  /** Versión web grande de la primera foto (galería del obrador). */
  imageLarge: string | null;
  image2: string | null;
  video: string | null;
  categoryId: string | null;
  seasonId: string | null;
  availability: Availability;
  orderDeadline: string | null;
  deliveryFrom: string | null;
  deliveryTo: string | null;
  unitsAvailable: number | null;
}
