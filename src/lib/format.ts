/** Utilidades de formato (sin dependencias de servidor: se usan también en el navegador). */
const TZ = "Europe/Madrid";

export function euros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "Precio a consultar";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function dateLong(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(d);
}

export function dateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: TZ }).format(d);
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function timeOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function minutesAgo(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

/** Fecha de hoy en Madrid como YYYY-MM-DD. */
export function todayMadrid(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p;
}

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits.startsWith("+") ? digits : "+34" + digits}`;
}

/** Enlace universal para abrir la navegación del móvil hacia una dirección. */
export function mapsLink(address: string, lat?: number | null, lng?: number | null): string {
  const dest = lat != null && lng != null ? `${lat},${lng}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
