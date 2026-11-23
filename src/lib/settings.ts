import "server-only";
import { all, run, nowIso, parseJson } from "./db";
import type { Locality, OrderStatus } from "./types";
import { legalDefaults, missingLegal, type LegalValues } from "./legal";

/**
 * Ajustes editables desde el panel. Los valores iniciales solo contienen datos publicados por Candú.
 * Todo lo que no está confirmado (precios, zonas, horarios, condiciones) empieza vacío o desactivado.
 */
export interface BusinessSettings {
  name: string;
  displayName: string;
  tagline: string;
  phone: string;
  whatsapp: string; // formato internacional sin "+", p. ej. 34630758193
  email: string;
  address: string;
  postalCode: string;
  instagram: string;
  hours: string;
  legalOwner: string;
  nif: string;
}

export interface StorySettings {
  title: string;
  paragraphs: string[];
  quote: string;
  quoteAuthor: string;
}

export interface RestaurantSettings {
  enabled: boolean;
  title: string;
  text: string;
  confirmed: boolean;
}

export interface GalleryItem {
  src: string;
  alt: string;
  caption: string;
  visible: boolean;
}

export interface CatalogSettings {
  categories: { id: string; name: string }[];
  seasons: { id: string; name: string }[];
  emptyTitle: string;
  emptyText: string;
}

export interface DeliverySettings {
  pickup: { enabled: boolean; address: string; notes: string };
  localities: Locality[];
  slots: string[];
  minOrderCents: number | null;
  conditions: string;
  origin: { lat: number | null; lng: number | null; label: string };
}

export interface PaymentSettings {
  codEnabled: boolean;
  codLabel: string;
  codNote: string;
  stripeLabel: string;
  stripeNote: string;
}

export type StatusLabels = Record<OrderStatus, string>;

export interface PrivacySettings {
  /** "on_end": borrar la posición al terminar el reparto. "24h": conservar la última posición 24 h. */
  locationRetention: "on_end" | "24h";
  /** Si un reparto no recibe posición en este número de horas, se cierra solo y se borra la ubicación. */
  staleRouteHours: number;
  /** Segundos tras los que una posición deja de mostrarse como "actual". */
  liveSeconds: number;
}

export interface LegalSettings {
  avisoLegal: string;
  privacidad: string;
  cookies: string;
  condiciones: string;
  reviewed: boolean;
}

export interface AllSettings {
  business: BusinessSettings;
  story: StorySettings;
  restaurants: RestaurantSettings;
  gallery: GalleryItem[];
  catalog: CatalogSettings;
  delivery: DeliverySettings;
  payments: PaymentSettings;
  statuses: StatusLabels;
  privacy: PrivacySettings;
  legal: LegalSettings;
  /** Datos legales configurables (definidos en src/config/legal.config.json). */
  legalInfo: LegalValues;
}

const P = "[PENDIENTE DE COMPLETAR]";

export const DEFAULTS: AllSettings = {
  business: {
    name: "Candú Alta Pastelería",
    displayName: "Juani",
    tagline: "Alta pastelería de temporada",
    phone: "630 758 193",
    whatsapp: "34630758193",
    email: "info@candualtapasteleria.com",
    address: "Las Cucharetas, Cortes de Baza (Granada)",
    postalCode: "18814",
    instagram: "candu_altapasteleria",
    hours: "",
    legalOwner: "",
    nif: "",
  },
  story: {
    title: "Más de veinte años entre masas, frutas y chocolate",
    paragraphs: [
      "Candú es el obrador de Juani en Las Cucharetas, en Cortes de Baza (Granada). Lleva más de veinte años dedicada a la pastelería.",
      "En 2018 se formó con Paco Torreblanca, una experiencia que afinó su técnica y reforzó su amor por la pastelería francesa.",
      "Trabaja con ingredientes frescos y naturales, como la fruta de temporada, y evita en lo posible los productos industriales y ultraprocesados.",
    ],
    quote: "Mi masa de roscón de Reyes se elabora artesanalmente, sin aditivos ni premezclas.",
    quoteAuthor: "Juani",
  },
  restaurants: {
    enabled: true,
    title: "Postres para restaurantes",
    text: "Candú también elabora postres para restaurantes y los transporta en furgoneta frigorífica. Si tienes un restaurante, escríbenos y hablamos de tu carta.",
    confirmed: false,
  },
  gallery: [
    { src: "/obrador/candu-1.jpg", alt: "Postre con forma de cereza cortado por la mitad, con interior blanco y corazón oscuro, junto a cerezas, lima y hojas sobre fondo verde", caption: "Cortes que cuentan lo que hay dentro", visible: true },
    { src: "/obrador/candu-2.jpg", alt: "Piezas glaseadas en rojo cortadas, con capas de bizcocho, junto a fresas y una cuchara sobre fondo rosa y verde", caption: "Glaseados y capas", visible: true },
    { src: "/obrador/candu-3.jpg", alt: "Pastel con forma de rosa roja cortado, con relleno de crema, junto a una rama de rosal y pétalos sobre fondo verde azulado", caption: "La rosa", visible: true },
    { src: "/obrador/candu-4.jpg", alt: "Bombón grande de chocolate cortado junto a avellanas y un saco de arpillera", caption: "Chocolate y avellana", visible: true },
    { src: "/obrador/candu-5.jpg", alt: "Postre con forma de coco abierto por la mitad, con interior cremoso y gelificado, rodeado de trozos de coco", caption: "Coco", visible: true },
    { src: "/obrador/candu-6.jpg", alt: "Pastel blanco con forma de rosa cortado, con pétalos blancos, avellanas y una rama de rosal", caption: "Rosa blanca", visible: true },
    { src: "/obrador/candu-8.jpg", alt: "Juani, con chaquetilla roja, apoyada en la mesa del obrador junto a una selección de tartas y pasteles", caption: "Juani en el obrador", visible: true },
  ],
  catalog: {
    categories: [],
    seasons: [],
    emptyTitle: "El escaparate cambia con la temporada",
    emptyText:
      "Ahora mismo no hay piezas publicadas. El catálogo de Candú cambia según la temporada: vuelve a consultarlo pronto o escríbenos por WhatsApp para preguntar qué se está preparando.",
  },
  delivery: {
    pickup: { enabled: false, address: "", notes: "" },
    localities: [
      { id: "baza", name: "Baza", enabled: false, confirmed: false, feeCents: null, minOrderCents: null, notes: "", lat: 37.4906, lng: -2.7731 },
      { id: "cortes-de-baza", name: "Cortes de Baza", enabled: false, confirmed: false, feeCents: null, minOrderCents: null, notes: "", lat: 37.6553, lng: -2.7711 },
      { id: "zujar", name: "Zújar", enabled: false, confirmed: false, feeCents: null, minOrderCents: null, notes: "", lat: 37.5408, lng: -2.8424 },
      { id: "los-laneros", name: "Los Laneros", enabled: false, confirmed: false, feeCents: null, minOrderCents: null, notes: "", lat: null, lng: null },
    ],
    slots: [],
    minOrderCents: null,
    conditions: "",
    origin: { lat: null, lng: null, label: "Obrador (Las Cucharetas)" },
  },
  payments: {
    codEnabled: false,
    codLabel: "Pago al recibir o al recoger",
    codNote: "Pagas en efectivo o como acuerdes con Candú al recibir el pedido.",
    stripeLabel: "Tarjeta de crédito o débito",
    stripeNote: "Pago seguro en la página de Stripe. La web no guarda los datos de tu tarjeta.",
  },
  statuses: {
    received: "Pedido recibido",
    confirmed: "Pedido confirmado",
    preparing: "En preparación",
    out_for_delivery: "En reparto",
    delivered: "Entregado",
    cancelled: "Cancelado",
    incident: "Incidencia en la entrega",
  },
  privacy: { locationRetention: "on_end", staleRouteHours: 6, liveSeconds: 120 },
  legalInfo: legalDefaults(),
  legal: {
    reviewed: false,
    avisoLegal: `## Titular de la web
En cumplimiento del artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI-CE):
- Titular: {{titular}}
- NIF: {{nif}}
- Nombre comercial: Candú Alta Pastelería
- Domicilio: {{domicilio}}
- Correo electrónico: {{email}}
- Teléfono: {{telefono}}
- Registro sanitario: {{registroSanitario}}
{{registroMercantilLinea}}

## Objeto
Esta web informa sobre los productos de Candú Alta Pastelería y permite hacer pedidos de los productos publicados en cada temporada.

## Propiedad intelectual
Las fotografías y textos de esta web pertenecen a su titular. No pueden reutilizarse sin autorización.

## Responsabilidad
${P}: revisar con un asesor legal antes de publicar.`,
    privacidad: `## Responsable del tratamiento
{{titular}} · NIF {{nif}} · {{domicilio}} · {{email}} · {{telefono}}

## Qué datos tratamos y para qué
- Pedidos: nombre, teléfono, dirección y localidad de entrega, fecha o franja solicitada y notas. Se usan solo para preparar y entregar tu pedido y contactar contigo sobre él.
- Pagos: los gestionan Stripe o PayPal en sus propias páginas. Esta web no recibe ni guarda los datos de tu tarjeta.
- Avisos por WhatsApp: solo si lo aceptas expresamente al hacer el pedido.
- Seguimiento del reparto: mientras tu pedido está en reparto puedes ver la ubicación aproximada del repartidor desde tu enlace privado. No se recoge tu ubicación.

## Base legal
Ejecución del contrato de compraventa (pedido) y, para los avisos por WhatsApp, tu consentimiento.

## Conservación
{{conservacion}}. La ubicación del repartidor se borra al terminar el reparto.

## Destinatarios
Proveedores necesarios para prestar el servicio: {{proveedores}}.

## Tus derechos
Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a info@candualtapasteleria.com. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`,
    cookies: `## Cookies que usamos
Esta web solo usa almacenamiento técnico necesario:
- Cesta de la compra: se guarda en tu navegador (almacenamiento local) para recordar los productos que eliges.
- Acceso al panel privado: una cookie de sesión solo para la administración.
- Preferencia de modo ligero y aviso de cookies: almacenamiento local.

No usamos cookies de analítica ni de publicidad. Si en el futuro se añaden, se pedirá tu consentimiento antes de activarlas.

## Servicios de terceros
Al pagar se te redirige a Stripe o PayPal, que aplican sus propias políticas. El mapa de seguimiento carga imágenes de OpenStreetMap.`,
    condiciones: `## Pedidos
Los productos se elaboran por tandas y según la temporada. Cada producto indica su disponibilidad, fecha límite para pedir y fechas de entrega cuando están definidas. Candú confirmará tu pedido.

## Vendedor
{{titular}} (Candú Alta Pastelería), NIF {{nif}}, {{domicilio}}. Contacto: {{email}} · {{telefono}}.

## Precios y pagos
{{iva}} Los métodos de pago disponibles se muestran al hacer el pedido.

## Entrega y recogida
{{plazoEntrega}}. Las localidades, costes y franjas disponibles se muestran al hacer el pedido.

## Confirmación del pedido
Al terminar el pedido se muestra en pantalla su confirmación con un enlace privado de seguimiento (art. 28 LSSI-CE).

## Cancelaciones y desistimiento
Los productos de pastelería son perecederos y se elaboran por encargo, por lo que puede no aplicarse el derecho de desistimiento (art. 103 del Texto Refundido de la Ley General para la Defensa de los Consumidores). ${P}: revisar con un asesor.

## Alérgenos
Consulta la información de alérgenos de cada producto y, ante cualquier duda, pregunta a Candú antes de pedir.

## Quejas y reclamaciones
{{reclamaciones}}`,
  },
};

type Key = keyof AllSettings;

export async function getSettings(): Promise<AllSettings> {
  const rows = await all<{ key: string; value: string }>(`SELECT key, value FROM settings`);
  const out = structuredClone(DEFAULTS) as AllSettings;
  for (const r of rows) {
    const k = r.key as Key;
    if (!(k in out)) continue;
    const val = parseJson<unknown>(r.value, null);
    if (val === null) continue;
    if (Array.isArray(DEFAULTS[k])) {
      (out as unknown as Record<string, unknown>)[k] = val;
    } else {
      (out as unknown as Record<string, unknown>)[k] = { ...(DEFAULTS[k] as object), ...(val as object) };
    }
  }
  return out;
}

export async function saveSetting<K extends Key>(key: K, value: AllSettings[K]): Promise<void> {
  await run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), nowIso()],
  );
}

/** Lista de avisos para el panel: datos que siguen pendientes de confirmar. */
export function pendingConfirmations(s: AllSettings): string[] {
  const out: string[] = [];
  if (!s.delivery.pickup.enabled && !s.delivery.localities.some((l) => l.enabled))
    out.push("No hay ninguna forma de entrega activa: activa la recogida o alguna localidad para poder recibir pedidos.");
  if (s.delivery.localities.some((l) => l.enabled && !l.confirmed))
    out.push("Hay localidades activas sin confirmar sus condiciones.");
  if (!s.restaurants.confirmed && s.restaurants.enabled)
    out.push("El texto «Postres para restaurantes» procede de una candidatura externa: confírmalo o desactívalo.");
  if (!s.legal.reviewed) out.push("Los textos legales son borradores: revísalos antes de publicar la web.");
  const missing = missingLegal(s.legalInfo);
  if (missing.length) out.push(`Faltan ${missing.length} datos legales obligatorios (titular, NIF, registro sanitario…): Ajustes › Datos legales.`);
  return out;
}
