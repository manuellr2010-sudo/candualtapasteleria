/**
 * Plantillas visuales de la ficha de producto y alérgenos de declaración obligatoria.
 * Módulo compartido por el servidor, la web y el panel (no contiene datos privados).
 */
export const PRODUCT_TEMPLATES = [
  {
    id: "atelier",
    name: "Atelier",
    summary: "Galería a la izquierda y ficha a la derecha. La opción clara y versátil para cualquier pieza.",
  },
  {
    id: "editorial",
    name: "Editorial",
    summary: "Foto a sangre que ocupa la pantalla y título grande encima, como una portada de revista.",
  },
  {
    id: "galeria",
    name: "Galería",
    summary: "Fotos y vídeos en una tira horizontal que se desliza, con la compra siempre a mano.",
  },
  {
    id: "minimal",
    name: "Esencial",
    summary: "Una sola imagen centrada, mucho aire y tipografía pequeña. Para piezas que hablan solas.",
  },
  {
    id: "temporada",
    name: "Temporada",
    summary: "Mosaico de fotos y tarjetas que destacan la fecha límite y las entregas. Ideal para encargos con fecha.",
  },
] as const;

export type ProductTemplate = (typeof PRODUCT_TEMPLATES)[number]["id"];

export function isTemplate(x: unknown): x is ProductTemplate {
  return PRODUCT_TEMPLATES.some((t) => t.id === x);
}

/** Los 14 alérgenos del Reglamento (UE) 1169/2011. Juani marca los que contiene cada pieza. */
export const ALLERGENS: readonly { id: string; name: string }[] = [
  { id: "gluten", name: "Gluten" },
  { id: "crustaceos", name: "Crustáceos" },
  { id: "huevo", name: "Huevo" },
  { id: "pescado", name: "Pescado" },
  { id: "cacahuetes", name: "Cacahuetes" },
  { id: "soja", name: "Soja" },
  { id: "lacteos", name: "Leche y lácteos" },
  { id: "frutos-cascara", name: "Frutos de cáscara" },
  { id: "apio", name: "Apio" },
  { id: "mostaza", name: "Mostaza" },
  { id: "sesamo", name: "Sésamo" },
  { id: "sulfitos", name: "Sulfitos" },
  { id: "altramuces", name: "Altramuces" },
  { id: "moluscos", name: "Moluscos" },
];

export function allergenNames(ids: string[]): string[] {
  return ids.map((id) => ALLERGENS.find((a) => a.id === id)?.name).filter((x): x is string => Boolean(x));
}
