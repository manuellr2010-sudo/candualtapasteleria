import { z } from "zod";

const phone = z
  .string()
  .transform((s) => s.replace(/[\s.\-()]/g, ""))
  .refine((s) => /^(\+34|0034)?[6789]\d{8}$/.test(s), "Escribe un teléfono español válido (9 cifras).");

export const checkoutSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.string().min(1).max(40), qty: z.number().int().min(1).max(50) }))
      .min(1, "La cesta está vacía.")
      .max(30),
    name: z.string().trim().min(2, "Escribe tu nombre.").max(80),
    phone,
    deliveryType: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(200).optional().default(""),
    localityId: z.string().max(60).optional().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha."),
    slot: z.string().trim().max(60).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
    paymentMethod: z.enum(["stripe", "paypal", "cod"]),
    acceptTerms: z.literal(true, { message: "Debes aceptar las condiciones y la política de privacidad." }),
    whatsappConsent: z.boolean().optional().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.deliveryType === "delivery") {
      if (d.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: "Escribe la dirección de entrega." });
      if (!d.localityId) ctx.addIssue({ code: "custom", path: ["localityId"], message: "Elige la localidad." });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
});

/** Convierte "12,50" o "12.5" en céntimos. Devuelve null si está vacío; NaN si no es válido. */
export function parseEuros(input: string | null | undefined): number | null {
  const s = (input ?? "").trim().replace(/\s|€/g, "").replace(",", ".");
  if (!s) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Math.round(parseFloat(s) * 100);
}

export function parseIntOrNull(input: string | null | undefined): number | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n < 100000 ? n : Number.NaN;
}
