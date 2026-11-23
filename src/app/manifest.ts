import type { MetadataRoute } from "next";

/**
 * Manifiesto de la web instalable. En Android, al instalarla, aparece «Candú» en el menú
 * «Compartir» de la galería o de WhatsApp: los archivos llegan a /api/admin/share y se crea un borrador.
 * (iOS no admite compartir hacia webs instaladas: allí se usa el botón «Subir fotos».)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Candú Alta Pastelería",
    short_name: "Candú",
    description: "Pedidos y panel de Candú Alta Pastelería",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7f1",
    theme_color: "#2b1e18",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // share_target aún no está en los tipos de Next, pero los navegadores Android lo admiten.
    ...({
      share_target: {
        action: "/api/admin/share",
        method: "POST",
        enctype: "multipart/form-data",
        params: { title: "title", text: "text", files: [{ name: "media", accept: ["image/*", "video/*"] }] },
      },
    } as object),
  };
}
