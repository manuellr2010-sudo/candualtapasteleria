import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
/** Host de un proveedor de mapas propio (MAP_TILES=https://…), si se usa. */
const customTiles = (() => {
  try {
    const t = process.env.MAP_TILES ?? "";
    return t.startsWith("https://") ? new URL(t.replace(/\{[a-z]\}/g, "a")).origin : "";
  } catch {
    return "";
  }
})();
const blobHosts = "https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com";
/**
 * Política de seguridad de contenidos: solo se cargan recursos del propio sitio y de los servicios que usa
 * (fotos en Vercel Blob, mapa de OpenStreetMap, páginas de pago de Stripe/PayPal).
 * 'unsafe-inline' en scripts es necesario para los scripts de arranque de Next.js; el resto queda cerrado.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${blobHosts} https://tile.openstreetmap.org ${customTiles}`.trim(),
  `media-src 'self' blob: ${blobHosts}`,
  // blob:/data: = texturas de los modelos 3D que el propio navegador desempaqueta en memoria.
  `connect-src 'self' blob: data: ${blobHosts} https://vercel.com https://blob.vercel-storage.com https://vercel.live wss://ws-us3.pusher.com`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src https://vercel.live",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://www.paypal.com https://www.sandbox.paypal.com",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // La geolocalización solo la usa el propio sitio (pantalla de reparto).
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Servidor autónomo (carpeta .next/standalone) para Docker o VPS. En Vercel no hace falta.
  output: process.env.VERCEL ? undefined : "standalone",
  // Nunca empaquetar datos locales, documentación ni archivos de entorno.
  outputFileTracingExcludes: { "*": ["data/**", "docs/**", ".env*", "tests/**", "scripts/**"] },
  serverExternalPackages: ["@libsql/client", "sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Direcciones de la web actual (Webador): se redirigen para no perder enlaces ni posicionamiento.
  async redirects() {
    return [
      { source: "/nuestros-postres", destination: "/#temporada", permanent: true },
      { source: "/quien-somos", destination: "/#juani", permanent: true },
      { source: "/contactanos", destination: "/#contacto", permanent: true },
    ];
  },
  async headers() {
    // Vista previa (Vercel Preview o PREVIEW_MODE=1): ninguna página debe aparecer en buscadores.
    const preview = process.env.PREVIEW_MODE === "1" || (Boolean(process.env.VERCEL) && process.env.VERCEL_ENV !== "production");
    return [
      { source: "/:path*", headers: securityHeaders },
      ...(preview ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }] : []),
      {
        // Páginas privadas: que no se indexen ni se guarden en cachés compartidas.
        source: "/(admin|seguimiento)/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
