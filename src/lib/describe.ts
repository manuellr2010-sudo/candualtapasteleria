/**
 * Descripción sugerida para un borrador.
 *
 * Reglas de seguridad: NO deduce ingredientes, sabores ni alérgenos a partir de fotos.
 * Solo reorganiza lo que Juani haya escrito (pie de foto o notas) y deja huecos marcados
 * con [Completa: …] que impiden publicar hasta que se rellenen o se borren.
 */
export const PLACEHOLDER_RE = /\[Completa:[^\]]*\]/;

export function suggestDescription(input: { title?: string; notes?: string; category?: string }): string {
  const notes = (input.notes ?? "").replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  if (notes) {
    const clean = notes.charAt(0).toUpperCase() + notes.slice(1);
    lines.push(/[.!?…]$/.test(clean) ? clean : clean + ".");
  } else {
    lines.push("[Completa: cuenta en una o dos frases cómo es esta pieza]");
  }
  lines.push("Elaborado en el obrador de Candú, en Las Cucharetas (Cortes de Baza).");
  lines.push("[Completa: sabores e ingredientes principales, solo si los confirmas tú]");
  return lines.join("\n\n");
}

export function hasPlaceholders(text: string): boolean {
  return PLACEHOLDER_RE.test(text);
}
