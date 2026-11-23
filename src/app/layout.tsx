import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { baseUrl, isPreview } from "@/lib/env";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(baseUrl()),
    title: { default: "Candú Alta Pastelería · Obrador en Cortes de Baza", template: "%s · Candú Alta Pastelería" },
    description:
      "Alta pastelería de temporada del obrador de Juani en Las Cucharetas, Cortes de Baza (Granada). Consulta lo disponible y haz tu pedido.",
    openGraph: { type: "website", locale: "es_ES", siteName: "Candú Alta Pastelería", images: ["/obrador/candu-1.jpg"] },
    icons: { icon: "/icon.svg" },
    // La vista previa nunca debe indexarse (también se envía la cabecera X-Robots-Tag).
    robots: isPreview() ? { index: false, follow: false, nocache: true } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf7f1",
  width: "device-width",
  initialScale: 1,
};

/**
 * Modo ligero: se activa solo en dispositivos con pocos recursos o ahorro de datos,
 * o manualmente desde el pie de página. Desactiva el 3D y las animaciones de scroll.
 */
const liteScript = `(function(){var d=document.documentElement;try{var s=localStorage.getItem('candu-lite');var n=navigator,c=n.connection||{};var auto=(c.saveData===true)||(n.deviceMemory&&n.deviceMemory<=2)||(n.hardwareConcurrency&&n.hardwareConcurrency<=2);if(s==='1'||(s===null&&auto))d.dataset.lite='1';var m=localStorage.getItem('candu-motion');var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;d.dataset.motion=m==='full'?'full':m==='reduced'?'reduced':(r?'reduced':'full');if(!m&&r)d.dataset.motionAuto='1';}catch(e){d.dataset.motion='reduced';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: liteScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
