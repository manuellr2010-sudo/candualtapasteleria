import type { MetadataRoute } from "next";
import { baseUrl, isPreview } from "@/lib/env";

export const dynamic = "force-dynamic";

/** En la vista previa no se indexa nada. En producción, nunca el panel, el seguimiento ni la API. */
export default function robots(): MetadataRoute.Robots {
  if (isPreview()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/seguimiento", "/api", "/pedido"] }],
    host: baseUrl(),
  };
}
