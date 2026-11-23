import config from "@/config/legal.config.json";

/**
 * Datos legales configurables. El archivo src/config/legal.config.json define qué datos hacen falta y por qué;
 * los valores los rellena Juani en Panel › Ajustes › Datos legales y se guardan en la base de datos (settings.legalInfo).
 */
export interface LegalField {
  id: string;
  etiqueta: string;
  tipo: "texto" | "nif" | "email" | "casilla" | "opciones";
  opciones?: string[];
  obligatorio: boolean;
  obligatorioSi?: { campo: string; valor: string };
  publico: boolean;
  ley: string;
  ayuda: string;
  valorInicial?: string;
}

export interface LegalGroup {
  id: string;
  titulo: string;
  campos: LegalField[];
}

export type LegalValues = Record<string, string | boolean>;

export const LEGAL_CONFIG = config as { version: number; descripcion: string; grupos: LegalGroup[]; notas: string[] };
export const LEGAL_FIELDS: LegalField[] = LEGAL_CONFIG.grupos.flatMap((g) => g.campos);

/** Valores iniciales: solo los datos que Candú ya publica (correo, teléfono, dirección). */
export function legalDefaults(): LegalValues {
  const out: LegalValues = {};
  for (const f of LEGAL_FIELDS) out[f.id] = f.tipo === "casilla" ? false : (f.valorInicial ?? "");
  return out;
}

export function isRequired(f: LegalField, v: LegalValues): boolean {
  if (f.obligatorio) return true;
  return Boolean(f.obligatorioSi && v[f.obligatorioSi.campo] === f.obligatorioSi.valor);
}

/** NIF español: DNI (8 cifras + letra), NIE (X/Y/Z + 7 cifras + letra) o CIF de sociedad (letra + 7 cifras + control). */
export function validNif(raw: string): boolean {
  const s = raw.toUpperCase().replace(/[\s.-]/g, "");
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  const dni = s.match(/^(\d{8})([A-Z])$/);
  if (dni) return letters[Number(dni[1]) % 23] === dni[2];
  const nie = s.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nie) return letters[Number(`${"XYZ".indexOf(nie[1])}${nie[2]}`) % 23] === nie[3];
  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s);
}

/** Campos obligatorios sin completar (o con formato no válido). */
export function missingLegal(v: LegalValues): LegalField[] {
  return LEGAL_FIELDS.filter((f) => {
    if (!isRequired(f, v)) return false;
    const val = v[f.id];
    if (f.tipo === "casilla") return val !== true;
    const str = typeof val === "string" ? val.trim() : "";
    if (!str) return true;
    if (f.tipo === "nif") return !validNif(str);
    if (f.tipo === "email") return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    return false;
  });
}

const pending = (label: string) => `[PENDIENTE: ${label}]`;

/**
 * Sustituye {{campo}} en los textos legales por los valores configurados.
 * Lo que falta se muestra como [PENDIENTE: …] (resaltado en amarillo en la web).
 * Marcadores derivados: {{iva}}, {{reclamaciones}}, {{registroMercantilLinea}}.
 */
export function fillLegal(text: string, v: LegalValues): string {
  const derived: Record<string, string> = {
    iva: v.preciosConIva === true ? "Los precios mostrados incluyen el IVA. Los gastos de entrega, si los hay, se indican antes de confirmar el pedido." : pending("confirmar si los precios incluyen IVA"),
    reclamaciones:
      v.hojasReclamaciones === true
        ? "Existen hojas de quejas y reclamaciones a disposición de las personas consumidoras y usuarias. Puedes solicitarlas o presentarlas también a través de consumoresponde.es."
        : pending("confirmar las hojas de quejas y reclamaciones de la Junta de Andalucía"),
    registroMercantilLinea:
      v.formaJuridica === "Sociedad (S.L., S.Coop., etc.)"
        ? `Datos registrales: ${typeof v.registroMercantil === "string" && v.registroMercantil.trim() ? v.registroMercantil.trim() : pending("datos del Registro Mercantil")}`
        : "",
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    if (key in derived) return derived[key];
    const f = LEGAL_FIELDS.find((x) => x.id === key);
    if (!f) return "";
    const val = v[key];
    if (typeof val === "string" && val.trim()) return val.trim();
    return pending(f.etiqueta);
  });
}
