import "./site.css";
import "./site-2026.css";
import { getSettings } from "@/lib/settings";
import { isPreview, stripeMode } from "@/lib/env";
import { CartProvider } from "@/components/site/CartProvider";
import { Header } from "@/components/site/Header";
import { CartDrawer } from "@/components/site/CartDrawer";
import { Footer } from "@/components/site/Footer";
import { CookieNotice, Interactions } from "@/components/site/SiteChrome";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <CartProvider>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <Header whatsapp={s.business.whatsapp} phone={s.business.phone} />
      <main id="contenido">{children}</main>
      <Footer b={s.business} />
      <CartDrawer />
      <CookieNotice />
      <Interactions />
      {isPreview() && (
        <p className="preview-badge" role="note">
          <b>Vista previa para revisión.</b> No es la web oficial.{" "}
          {stripeMode() === "test" ? "Pagos con tarjeta en modo prueba: no se cobra dinero real." : stripeMode() === "live" ? "" : "Pagos online pendientes de configurar."}
        </p>
      )}
    </CartProvider>
  );
}
