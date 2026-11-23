import type { Metadata, Viewport } from "next";
import "../(site)/site.css";
import "../(site)/site-2026.css";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Panel · Candú", template: "%s · Panel Candú" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#2b1e18" };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
