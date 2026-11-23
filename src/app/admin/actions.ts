"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authConfigured,
  clearLoginAttempts,
  clearSessionCookie,
  clientIp,
  loginBlocked,
  registerFailedLogin,
  requireAdmin,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { baseUrl, config } from "@/lib/env";
import { logEvent } from "@/lib/log";
import {
  createDraft,
  deleteDraft,
  duplicateProduct,
  getProduct,
  publishProblems,
  publishProduct,
  setSoldOut,
  setStatus,
  updateProduct,
  type ProductPatch,
} from "@/lib/products";
import { setMediaAlt } from "@/lib/storage";
import { deleteOrderPersonalData, getOrder, regenerateTrackingToken, setOrderPriority, setOrderStatus } from "@/lib/orders";
import { notifyCustomerStatus } from "@/lib/notify";
import { getSettings, saveSetting, type AllSettings } from "@/lib/settings";
import { parseEuros, parseIntOrNull } from "@/lib/validation";
import { slugify } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { ALLERGENS, isTemplate } from "@/lib/templates";
import { LEGAL_FIELDS, missingLegal, validNif, type LegalValues } from "@/lib/legal";

/* ── Acceso ── */
export async function loginAction(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const cfg = authConfigured();
  if (!cfg.ok) return { error: `El panel no está configurado: ${cfg.reason}` };
  const ip = await clientIp();
  const wait = loginBlocked(ip);
  if (wait) return { error: `Demasiados intentos. Prueba de nuevo en ${wait} min.` };
  const pw = String(fd.get("password") ?? "");
  if (!pw || !(await verifyPassword(pw, config.adminHash))) {
    registerFailedLogin(ip);
    await logEvent("warn", "acceso", "Intento de acceso al panel con contraseña incorrecta.");
    return { error: "Contraseña incorrecta." };
  }
  clearLoginAttempts(ip);
  await setSessionCookie();
  redirect("/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/acceso");
}

/* ── Productos ── */
export async function createDraftAction(mediaIds: string[], notes: string): Promise<string> {
  await requireAdmin();
  const ids = mediaIds.filter((x) => /^[A-Za-z0-9_-]{6,20}$/.test(x)).slice(0, 20);
  const id = await createDraft({ mediaIds: ids, notes: notes.slice(0, 1000), source: "upload" });
  revalidatePath("/admin/productos");
  return id;
}

export async function newEmptyDraftAction() {
  await requireAdmin();
  const id = await createDraft({ mediaIds: [], source: "manual" });
  redirect(`/admin/productos/${id}`);
}

export interface SaveResult {
  ok: boolean;
  message: string;
  problems?: string[];
}

function patchFrom(fd: FormData): { patch?: ProductPatch; errors: string[] } {
  const errors: string[] = [];
  const price = parseEuros(String(fd.get("price") ?? ""));
  if (Number.isNaN(price)) errors.push("El precio no es válido (ejemplo: 24,50).");
  const units = parseIntOrNull(String(fd.get("units") ?? ""));
  if (Number.isNaN(units)) errors.push("Las unidades deben ser un número entero.");
  const date = (k: string) => {
    const v = String(fd.get(k) ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  const deadlineRaw = String(fd.get("deadline") ?? "").trim();
  const deadline = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadlineRaw) ? new Date(`${deadlineRaw}:00+01:00`).toISOString() : null;
  let mediaIds: string[] = [];
  try {
    mediaIds = (JSON.parse(String(fd.get("mediaIds") ?? "[]")) as string[]).filter((x) => /^[A-Za-z0-9_-]{6,20}$/.test(x)).slice(0, 20);
  } catch {
    errors.push("Lista de fotos no válida.");
  }
  if (errors.length) return { errors };
  return {
    errors,
    patch: {
      title: String(fd.get("title") ?? "").trim().slice(0, 120),
      description: String(fd.get("description") ?? "").trim().slice(0, 3000),
      priceCents: price,
      unitsAvailable: units,
      categoryId: String(fd.get("categoryId") ?? "") || null,
      seasonId: String(fd.get("seasonId") ?? "") || null,
      orderDeadline: deadline,
      deliveryFrom: date("deliveryFrom"),
      deliveryTo: date("deliveryTo"),
      deliveryNote: String(fd.get("deliveryNote") ?? "").trim().slice(0, 300),
      allergenNotes: String(fd.get("allergenNotes") ?? "").trim().slice(0, 1000),
      // Solo se guardan como confirmados si Juani marca la casilla; si no, la web pide consultar.
      allergens:
        fd.get("allergensConfirmed") === "on"
          ? fd.getAll("allergen").map(String).filter((a) => ALLERGENS.some((x) => x.id === a))
          : null,
      template: isTemplate(fd.get("template")) ? String(fd.get("template")) : "atelier",
      tagline: String(fd.get("tagline") ?? "").trim().slice(0, 140),
      deliverySlot: String(fd.get("deliverySlot") ?? "").trim().slice(0, 120),
      mediaIds,
    },
  };
}

export async function saveProductAction(id: string, fd: FormData): Promise<SaveResult> {
  await requireAdmin();
  const { patch, errors } = patchFrom(fd);
  if (!patch) return { ok: false, message: "Revisa los campos.", problems: errors };
  const current = await getProduct(id);
  if (!current) return { ok: false, message: "El producto no existe." };
  if (current.status === "published") {
    // Un producto publicado no puede quedar en la web sin precio, con huecos [Completa: …] o sin fotos.
    const media = (await import("@/lib/storage")).getMedia;
    const candidate = { ...current, ...patch, media: await media(patch.mediaIds) };
    const problems = publishProblems(candidate);
    if (problems.length) return { ok: false, message: "No se guardó: el producto está publicado y quedaría incompleto.", problems };
  }
  await updateProduct(id, patch);
  const alts = fd.getAll("alt").map(String);
  const altIds = fd.getAll("altId").map(String);
  for (let i = 0; i < altIds.length; i++) await setMediaAlt(altIds[i], alts[i] ?? "");
  const intent = String(fd.get("intent") ?? "save");
  if (intent === "publish") {
    const problems = await publishProduct(id);
    if (problems.length) return { ok: false, message: "Guardado como borrador. Falta algo para publicar:", problems };
    revalidatePath("/");
    revalidatePath("/admin/productos");
    return { ok: true, message: "¡Publicado! Ya aparece en el catálogo." };
  }
  revalidatePath("/admin/productos");
  const p = await getProduct(id);
  if (p?.status === "published") revalidatePath("/");
  return { ok: true, message: p?.status === "published" ? "Cambios guardados y publicados." : "Borrador guardado. Aún no es visible para los clientes." };
}

export async function productStatusAction(id: string, action: "archive" | "unarchive" | "soldout" | "available" | "unpublish") {
  await requireAdmin();
  if (action === "archive") await setStatus(id, "archived");
  if (action === "unarchive" || action === "unpublish") await setStatus(id, "draft");
  if (action === "soldout") await setSoldOut(id, true);
  if (action === "available") await setSoldOut(id, false);
  revalidatePath("/");
  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${id}`);
}

export async function duplicateProductAction(id: string) {
  await requireAdmin();
  const nid = await duplicateProduct(id);
  redirect(nid ? `/admin/productos/${nid}` : "/admin/productos");
}

export async function deleteDraftAction(id: string) {
  await requireAdmin();
  await deleteDraft(id);
  redirect("/admin/productos");
}

/* ── Pedidos ── */
export async function orderStatusAction(id: string, status: OrderStatus) {
  await requireAdmin();
  const o = await setOrderStatus(id, status);
  if (o) await notifyCustomerStatus(o);
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
}

export async function orderPriorityAction(id: string, priority: boolean) {
  await requireAdmin();
  await setOrderPriority(id, priority);
  revalidatePath(`/admin/pedidos/${id}`);
}

export async function regenerateTrackingAction(id: string): Promise<string | null> {
  await requireAdmin();
  const token = await regenerateTrackingToken(id);
  revalidatePath(`/admin/pedidos/${id}`);
  return token ? `${baseUrl()}/seguimiento/${token}` : null;
}

export async function orderForgetAction(id: string) {
  await requireAdmin();
  const o = await getOrder(id);
  if (o && ["delivered", "cancelled"].includes(o.status)) await deleteOrderPersonalData(id);
  revalidatePath(`/admin/pedidos/${id}`);
}

/* ── Ajustes ── */
const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function saveSettingsAction(section: string, fd: FormData): Promise<SaveResult> {
  await requireAdmin();
  const s = await getSettings();
  try {
    switch (section) {
      case "negocio": {
        const wa = str(fd, "whatsapp", 20).replace(/[^\d]/g, "");
        await saveSetting("business", {
          ...s.business,
          name: str(fd, "name", 80) || s.business.name,
          displayName: str(fd, "displayName", 40) || "Juani",
          tagline: str(fd, "tagline", 120),
          phone: str(fd, "phone", 20),
          whatsapp: wa,
          email: str(fd, "email", 120),
          address: str(fd, "address", 200),
          postalCode: str(fd, "postalCode", 10),
          instagram: str(fd, "instagram", 60).replace(/^@/, ""),
          hours: str(fd, "hours", 200),
          // Titular y NIF se gestionan ahora en «Datos legales» (settings.legalInfo).
          legalOwner: s.business.legalOwner,
          nif: s.business.nif,
        });
        await saveSetting("story", {
          title: str(fd, "storyTitle", 140),
          paragraphs: str(fd, "storyParagraphs", 3000).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
          quote: str(fd, "quote", 300),
          quoteAuthor: str(fd, "quoteAuthor", 60),
        });
        await saveSetting("restaurants", {
          enabled: fd.get("restEnabled") === "on",
          title: str(fd, "restTitle", 100),
          text: str(fd, "restText", 600),
          confirmed: fd.get("restConfirmed") === "on",
        });
        break;
      }
      case "entregas": {
        const ids = fd.getAll("locId").map(String);
        const localities: AllSettings["delivery"]["localities"] = [];
        for (const [i, id] of ids.entries()) {
          const name = String(fd.getAll("locName")[i] ?? "").trim();
          if (!name) continue;
          const fee = parseEuros(String(fd.getAll("locFee")[i] ?? ""));
          const min = parseEuros(String(fd.getAll("locMin")[i] ?? ""));
          const lat = parseFloat(String(fd.getAll("locLat")[i] ?? "").replace(",", "."));
          const lng = parseFloat(String(fd.getAll("locLng")[i] ?? "").replace(",", "."));
          if (Number.isNaN(fee) || Number.isNaN(min)) return { ok: false, message: `Importe no válido en ${name}.` };
          localities.push({
            id: id || slugify(name) || `loc-${i}`,
            name: name.slice(0, 60),
            enabled: fd.getAll("locEnabled").map(String).includes(id || name),
            confirmed: fd.getAll("locConfirmed").map(String).includes(id || name),
            feeCents: fee,
            minOrderCents: min,
            notes: String(fd.getAll("locNotes")[i] ?? "").trim().slice(0, 200),
            lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
            lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
          });
        }
        const newName = str(fd, "newLocality", 60);
        if (newName) localities.push({ id: slugify(newName), name: newName, enabled: false, confirmed: false, feeCents: null, minOrderCents: null, notes: "", lat: null, lng: null });
        const minOrder = parseEuros(str(fd, "minOrder", 20));
        if (Number.isNaN(minOrder)) return { ok: false, message: "Pedido mínimo no válido." };
        const oLat = parseFloat(str(fd, "originLat", 20).replace(",", "."));
        const oLng = parseFloat(str(fd, "originLng", 20).replace(",", "."));
        await saveSetting("delivery", {
          pickup: { enabled: fd.get("pickupEnabled") === "on", address: str(fd, "pickupAddress", 200), notes: str(fd, "pickupNotes", 200) },
          localities,
          slots: str(fd, "slots", 1000).split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20),
          minOrderCents: minOrder,
          conditions: str(fd, "conditions", 1500),
          origin: { lat: Number.isFinite(oLat) ? oLat : null, lng: Number.isFinite(oLng) ? oLng : null, label: s.delivery.origin.label },
        });
        break;
      }
      case "pagos":
        await saveSetting("payments", {
          ...s.payments,
          codEnabled: fd.get("codEnabled") === "on",
          codLabel: str(fd, "codLabel", 80) || s.payments.codLabel,
          codNote: str(fd, "codNote", 200),
          stripeLabel: str(fd, "stripeLabel", 80) || s.payments.stripeLabel,
          stripeNote: str(fd, "stripeNote", 200),
        });
        break;
      case "catalogo": {
        const parseList = (k: string) =>
          str(fd, k, 2000)
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 30)
            .map((name) => ({ id: slugify(name), name: name.slice(0, 40) }));
        await saveSetting("catalog", {
          categories: parseList("categories"),
          seasons: parseList("seasons"),
          emptyTitle: str(fd, "emptyTitle", 120) || s.catalog.emptyTitle,
          emptyText: str(fd, "emptyText", 600) || s.catalog.emptyText,
        });
        break;
      }
      case "estados": {
        const next = { ...s.statuses };
        for (const k of Object.keys(next) as OrderStatus[]) next[k] = str(fd, k, 40) || next[k];
        await saveSetting("statuses", next);
        break;
      }
      case "privacidad": {
        const hours = Math.min(48, Math.max(1, Number(str(fd, "staleRouteHours", 3)) || 6));
        const live = Math.min(600, Math.max(30, Number(str(fd, "liveSeconds", 4)) || 120));
        await saveSetting("privacy", { locationRetention: fd.get("locationRetention") === "24h" ? "24h" : "on_end", staleRouteHours: hours, liveSeconds: live });
        break;
      }
      case "datos-legales": {
        const next: LegalValues = { ...s.legalInfo };
        for (const f of LEGAL_FIELDS) {
          if (f.tipo === "casilla") next[f.id] = fd.get(`lg_${f.id}`) === "on";
          else if (f.tipo === "opciones") {
            const v = str(fd, `lg_${f.id}`, 120);
            next[f.id] = f.opciones?.includes(v) ? v : "";
          } else next[f.id] = str(fd, `lg_${f.id}`, 400);
        }
        if (typeof next.nif === "string") next.nif = next.nif.toUpperCase().replace(/[\s.-]/g, "");
        if (next.nif && !validNif(String(next.nif))) return { ok: false, message: "El NIF/DNI no es válido: revisa los números y la letra." };
        await saveSetting("legalInfo", next);
        const missing = missingLegal(next);
        revalidatePath("/", "layout");
        return {
          ok: true,
          message: missing.length ? `Guardado. Aún faltan ${missing.length} datos obligatorios para completar los textos legales.` : "Guardado. Todos los datos legales obligatorios están completos.",
        };
      }
      case "legal":
        await saveSetting("legal", {
          avisoLegal: str(fd, "avisoLegal", 20000),
          privacidad: str(fd, "privacidad", 20000),
          cookies: str(fd, "cookies", 20000),
          condiciones: str(fd, "condiciones", 20000),
          reviewed: fd.get("reviewed") === "on",
        });
        break;
      case "galeria": {
        const srcs = fd.getAll("gSrc").map(String);
        await saveSetting(
          "gallery",
          srcs.map((src, i) => ({
            src,
            alt: String(fd.getAll("gAlt")[i] ?? "").slice(0, 300),
            caption: String(fd.getAll("gCaption")[i] ?? "").slice(0, 80),
            visible: fd.getAll("gVisible").map(String).includes(src),
          })),
        );
        break;
      }
      default:
        return { ok: false, message: "Sección desconocida." };
    }
  } catch (e) {
    await logEvent("error", "ajustes", `No se pudieron guardar los ajustes (${section}).`, String(e));
    return { ok: false, message: "No se pudo guardar. Inténtalo de nuevo." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Guardado." };
}
