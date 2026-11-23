import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings, type LegalSettings } from "@/lib/settings";
import { LegalText } from "@/components/site/LegalText";
import { fillLegal } from "@/lib/legal";

const DOCS: Record<string, { title: string; key: keyof Omit<LegalSettings, "reviewed"> }> = {
  "aviso-legal": { title: "Aviso legal", key: "avisoLegal" },
  privacidad: { title: "Política de privacidad", key: "privacidad" },
  cookies: { title: "Política de cookies", key: "cookies" },
  condiciones: { title: "Condiciones de compra", key: "condiciones" },
};

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(DOCS).map((legal) => ({ legal }));
}

type Params = { params: Promise<{ legal: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = DOCS[(await params).legal];
  return { title: d?.title ?? "Información" };
}

export default async function LegalPage({ params }: Params) {
  const d = DOCS[(await params).legal];
  if (!d) notFound();
  const s = await getSettings();
  // Los datos del titular (NIF, registro sanitario…) se configuran en Panel › Ajustes › Datos legales.
  return <LegalText title={d.title} text={fillLegal(s.legal[d.key], s.legalInfo)} reviewed={s.legal.reviewed} />;
}
