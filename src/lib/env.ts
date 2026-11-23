import "server-only";
import path from "node:path";
import { stripeKeyMode } from "./payments/stripe-core";

/** Lectura centralizada de variables de entorno del servidor. Nunca se exponen al navegador. */
function v(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const isProduction = process.env.NODE_ENV === "production";

export function baseUrl(): string {
  const explicit = v("PUBLIC_BASE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  // En Vercel, si no se indica, se usa la URL del propio despliegue (vista previa) o la de producción.
  const vercelHost = v("VERCEL_ENV") === "production" ? v("VERCEL_PROJECT_PRODUCTION_URL") : v("VERCEL_BRANCH_URL") || v("VERCEL_URL");
  if (vercelHost) return `https://${vercelHost.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** ¿Se ejecuta en Vercel? (sistema de archivos efímero y de solo lectura salvo /tmp) */
export const onVercel = Boolean(process.env.VERCEL);

/** "production" | "preview" | "development" según Vercel; en local, "local". */
export function deployEnv(): "production" | "preview" | "development" | "local" {
  const e = v("VERCEL_ENV");
  return e === "production" || e === "preview" || e === "development" ? e : "local";
}

/**
 * Vista previa (no es la web oficial): se marca como noindex y muestra un aviso.
 * En Vercel, todo lo que no sea el despliegue de producción; también se puede forzar con PREVIEW_MODE=1.
 */
export function isPreview(): boolean {
  if (v("PREVIEW_MODE") === "1") return true;
  return onVercel && deployEnv() !== "production";
}

export function dataDir(): string {
  const d = v("DATA_DIR");
  // En Vercel solo /tmp admite escritura y NO es persistente (se pierde al reiniciar cada instancia).
  if (!d && onVercel) return "/tmp/candu-data";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), d || "data");
}

/** URL de la base de datos libSQL remota (Turso). Admite los nombres que crea la integración de Vercel. */
export function databaseUrl(): string {
  return v("DATABASE_URL") || v("TURSO_DATABASE_URL");
}
export function databaseToken(): string {
  return v("DATABASE_AUTH_TOKEN") || v("TURSO_AUTH_TOKEN");
}

/** ¿Los datos sobreviven a un nuevo despliegue? En local/VPS con disco sí; en Vercel solo con base de datos remota. */
export function persistentDb(): boolean {
  return Boolean(databaseUrl()) || !onVercel;
}

/** Archivos en Vercel Blob (almacén privado) en lugar del disco local. */
export function blobEnabled(): boolean {
  return Boolean(v("BLOB_READ_WRITE_TOKEN"));
}
export function blobAccess(): "private" | "public" {
  return v("BLOB_ACCESS") === "public" ? "public" : "private";
}
export function persistentFiles(): boolean {
  return blobEnabled() || !onVercel;
}

export const config = {
  get adminHash() { return v("ADMIN_PASSWORD_HASH"); },
  get sessionSecret() { return v("SESSION_SECRET"); },
  stripe: {
    get secretKey() { return v("STRIPE_SECRET_KEY"); },
    get webhookSecret() { return v("STRIPE_WEBHOOK_SECRET"); },
  },
  paypal: {
    get env() { return v("PAYPAL_ENV") === "live" ? "live" : "sandbox"; },
    get clientId() { return v("PAYPAL_CLIENT_ID"); },
    get clientSecret() { return v("PAYPAL_CLIENT_SECRET"); },
    get webhookId() { return v("PAYPAL_WEBHOOK_ID"); },
  },
  whatsapp: {
    get graphVersion() { return v("WHATSAPP_GRAPH_VERSION") || "v24.0"; },
    get token() { return v("WHATSAPP_TOKEN"); },
    get phoneNumberId() { return v("WHATSAPP_PHONE_NUMBER_ID"); },
    get appSecret() { return v("WHATSAPP_APP_SECRET"); },
    get verifyToken() { return v("WHATSAPP_VERIFY_TOKEN"); },
    get ownerNumbers() { return list(v("WHATSAPP_OWNER_NUMBERS")); },
    get templateNewOrder() { return v("WHATSAPP_TEMPLATE_NEW_ORDER"); },
    get templateOrderStatus() { return v("WHATSAPP_TEMPLATE_ORDER_STATUS"); },
    get templateLang() { return v("WHATSAPP_TEMPLATE_LANG") || "es"; },
    get inboxAllowed() { return list(v("WHATSAPP_INBOX_ALLOWED_NUMBERS")); },
  },
  maps: {
    get tiles(): string { return v("MAP_TILES") || "osm"; },
    get geocoder() { return v("GEOCODER") === "nominatim" ? "nominatim" : "none"; },
    get orsKey() { return v("ORS_API_KEY"); },
  },
};

function list(s: string): string[] {
  return s.split(",").map((x) => x.replace(/[^\d]/g, "")).filter(Boolean);
}

export type IntegrationState = "connected" | "test" | "not_configured" | "manual";

export interface IntegrationInfo {
  id: string;
  name: string;
  state: IntegrationState;
  summary: string;
  manualSteps?: string;
}

/**
 * Cobros reales bloqueados por defecto: solo se permiten si el propietario lo autoriza con
 * ALLOW_LIVE_PAYMENTS=1 y nunca en una vista previa. Así una clave activa puesta por error no cobra.
 */
export function livePaymentsAllowed(): boolean {
  return v("ALLOW_LIVE_PAYMENTS") === "1" && !isPreview();
}

/** Modo de la clave configurada, aunque esté bloqueada (para avisar en el panel). */
export function stripeKeyConfiguredMode(): "test" | "live" | null {
  return stripeKeyMode(config.stripe.secretKey);
}

export function stripeMode(): "test" | "live" | null {
  const m = stripeKeyConfiguredMode();
  if (m === "live" && !livePaymentsAllowed()) return null;
  return m;
}

export function paypalMode(): "test" | "live" | null {
  if (!config.paypal.clientId || !config.paypal.clientSecret) return null;
  if (config.paypal.env === "live") return livePaymentsAllowed() ? "live" : null;
  return "test";
}

export function whatsappSendReady(): boolean {
  const w = config.whatsapp;
  return Boolean(w.token && w.phoneNumberId && w.ownerNumbers.length && w.templateNewOrder);
}

export function whatsappInboxReady(): boolean {
  const w = config.whatsapp;
  return Boolean(w.token && w.appSecret && w.verifyToken && w.inboxAllowed.length);
}

export function mapTilesUrl(): string | null {
  const t = config.maps.tiles;
  if (t === "none" || !t) return null;
  if (t === "osm") return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  if (t.startsWith("https://")) return t;
  return null;
}

export function integrations(): IntegrationInfo[] {
  const s = stripeMode();
  const p = paypalMode();
  const tiles = mapTilesUrl();
  return [
    {
      id: "database",
      name: "Base de datos (pedidos, productos, ajustes)",
      state: persistentDb() ? "connected" : "not_configured",
      summary: databaseUrl()
        ? "Base de datos libSQL remota (Turso): los datos se conservan entre despliegues."
        : onVercel
          ? "TEMPORAL: en Vercel sin base de datos remota los datos se pierden al reiniciar. Conecta Turso (ver docs/VERCEL.md)."
          : "Archivo local data/candu.db (haz copias de seguridad).",
    },
    {
      id: "files",
      name: "Archivos (fotos y vídeos)",
      state: persistentFiles() ? "connected" : "not_configured",
      summary: blobEnabled()
        ? `Vercel Blob (almacén ${blobAccess() === "private" ? "privado, con enlaces firmados" : "público"}).`
        : onVercel
          ? "TEMPORAL: en Vercel sin Blob las fotos subidas se pierden. Crea un almacén Blob privado (ver docs/VERCEL.md)."
          : "Carpeta local data/uploads.",
    },
    {
      id: "admin",
      name: "Acceso al panel",
      state: config.adminHash && config.sessionSecret.length >= 32 ? "connected" : "not_configured",
      summary: config.adminHash ? "Contraseña configurada en el servidor." : "Falta generar la contraseña (npm run admin:password).",
    },
    {
      id: "stripe",
      name: "Stripe · tarjeta (y Bizum / PayPal si se activan en Stripe)",
      state: s === "live" ? "connected" : s === "test" ? "test" : "not_configured",
      summary:
        s === "live"
          ? "Cobros reales activos." + (config.stripe.webhookSecret ? "" : " ¡Falta el secreto del webhook!")
          : s === "test"
            ? "Modo prueba: no se cobra dinero real." + (config.stripe.webhookSecret ? "" : " Falta el secreto del webhook.")
            : stripeKeyConfiguredMode() === "live"
              ? "Hay una clave ACTIVA (sk_live) pero los cobros reales están bloqueados hasta que el propietario lo autorice (ALLOW_LIVE_PAYMENTS=1, nunca en vista previa)."
              : "Sin claves. Los clientes no ven el pago con tarjeta.",
    },
    {
      id: "paypal",
      name: "PayPal directo",
      state: p === "live" ? "connected" : p === "test" ? "test" : "not_configured",
      summary: p ? (p === "live" ? "Cobros reales activos." : "Sandbox: pagos de prueba.") : "Sin credenciales. Opcional si PayPal se activa dentro de Stripe.",
    },
    {
      id: "whatsapp_send",
      name: "WhatsApp · avisos automáticos de pedido",
      state: whatsappSendReady() ? "connected" : "manual",
      summary: whatsappSendReady()
        ? "Los avisos se envían con la Cloud API de WhatsApp (plantilla aprobada)."
        : "No conectado. Se usa el botón «Abrir WhatsApp» con el mensaje preparado: hay que pulsar enviar a mano.",
    },
    {
      id: "whatsapp_inbox",
      name: "WhatsApp · recibir fotos en la bandeja",
      state: whatsappInboxReady() ? "connected" : "manual",
      summary: whatsappInboxReady()
        ? "Las fotos y vídeos enviados al número conectado crean borradores."
        : "No conectado. Sube o comparte las fotos desde el móvil en «Productos › Subir contenido».",
      manualSteps: "Los Estados de WhatsApp no se pueden leer con ninguna API oficial: hay que subir o reenviar los archivos.",
    },
    {
      id: "maps",
      name: "Mapa",
      state: tiles ? "connected" : "not_configured",
      summary: tiles
        ? config.maps.tiles === "osm"
          ? "Mapa de OpenStreetMap (uso ligero, con atribución)."
          : "Proveedor de teselas personalizado."
        : "Sin mapa: se muestra la lista ordenada con enlaces a la app de mapas.",
    },
    {
      id: "geocoder",
      name: "Localizar direcciones (geocodificación)",
      state: config.maps.geocoder === "nominatim" ? "connected" : "not_configured",
      summary:
        config.maps.geocoder === "nominatim"
          ? "Nominatim (OpenStreetMap). Uso limitado: 1 consulta por segundo."
          : "Desactivado: las paradas se sitúan en el centro aproximado de su localidad.",
    },
    {
      id: "routing",
      name: "Distancias por carretera",
      state: config.maps.orsKey ? "connected" : "not_configured",
      summary: config.maps.orsKey
        ? "openrouteservice: tiempos de conducción reales."
        : "Se usa la distancia en línea recta para sugerir el orden.",
    },
  ];
}
