export type ProductStatus = "draft" | "published" | "archived";

export interface MediaItem {
  id: string;
  kind: "image" | "video";
  mime: string;
  /** Ruta pública de la versión web (imagen optimizada o vídeo original). */
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  source: "upload" | "whatsapp" | "gallery";
  originalName: string;
  createdAt: string;
  needsConversion: boolean;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number | null;
  status: ProductStatus;
  soldOut: boolean;
  unitsAvailable: number | null;
  categoryId: string | null;
  seasonId: string | null;
  orderDeadline: string | null; // ISO
  deliveryFrom: string | null; // YYYY-MM-DD
  deliveryTo: string | null; // YYYY-MM-DD
  deliveryNote: string;
  allergenNotes: string;
  /** Alérgenos marcados por Juani. null = sin confirmar (la web pide consultar antes de pedir). */
  allergens: string[] | null;
  /** Plantilla visual de la ficha (ver lib/templates.ts). */
  template: string;
  /** Frase corta opcional bajo el título. */
  tagline: string;
  /** Franja de entrega, p. ej. «Sábado por la mañana». */
  deliverySlot: string;
  mediaIds: string[];
  media: MediaItem[];
  source: "upload" | "whatsapp" | "duplicate" | "manual";
  sourceNote: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export type OrderStatus = "received" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled" | "incident";
export const ORDER_FLOW: OrderStatus[] = ["received", "confirmed", "preparing", "out_for_delivery", "delivered"];

export type PaymentMethod = "stripe" | "paypal" | "cod";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "cod_pending" | "refunded";

export interface OrderItem {
  productId: string;
  title: string;
  unitCents: number;
  qty: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  deliveryType: "pickup" | "delivery";
  address: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  requestedDate: string | null;
  requestedSlot: string;
  notes: string;
  items: OrderItem[];
  subtotalCents: number;
  deliveryFeeCents: number | null;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRef: string | null;
  paymentMode: "test" | "live" | null;
  whatsappConsent: boolean;
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface Locality {
  id: string;
  name: string;
  enabled: boolean;
  confirmed: boolean;
  feeCents: number | null;
  minOrderCents: number | null;
  notes: string;
  lat: number | null;
  lng: number | null;
}

export interface Route {
  id: string;
  status: "active" | "ended";
  sharing: boolean;
  startedAt: string;
  endedAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastAccuracy: number | null;
  lastAt: string | null;
  manualLocality: string | null;
  manualAt: string | null;
}

export interface RouteStop {
  routeId: string;
  orderId: string;
  position: number;
  status: "pending" | "delivered" | "incident";
  note: string;
  reason: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  detail: string;
  createdAt: string;
}
