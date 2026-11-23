/**
 * Orden recomendado de paradas, pensado para poder explicarse en una frase:
 *
 *   1. Primero las franjas horarias más tempranas.
 *   2. Dentro de cada franja, primero los pedidos marcados como prioritarios.
 *   3. Después, siempre la parada más cercana a la anterior; luego se prueba a invertir
 *      tramos (mejora "2-opt") por si así se recorre menos distancia en total.
 *   4. Las paradas sin ubicación conocida van al final de su franja para colocarlas a mano.
 *
 * Sin dependencias: se usa en el servidor y en los tests.
 */
export interface Pt {
  lat: number;
  lng: number;
}

export interface StopInput {
  id: string;
  point: Pt | null;
  /** true si el punto es el centro aproximado de la localidad, no la dirección exacta. */
  approx: boolean;
  slot: string;
  priority: boolean;
}

export interface Suggestion {
  order: string[];
  reasons: Record<string, string>;
  totalKm: number | null;
}

export type DistFn = (a: Pt, b: Pt) => number;

export function haversineKm(a: Pt, b: Pt): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minutos desde medianoche del inicio de una franja: "10:00-13:00", "10-13", "de 9:30 a 11". */
export function slotStart(slot: string): number | null {
  const m = slot.match(/(\d{1,2})(?:[:.h](\d{2}))?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function pathCost(start: Pt | null, seq: StopInput[], dist: DistFn): number {
  let cost = 0;
  let prev = start;
  for (const s of seq) {
    if (prev && s.point) cost += dist(prev, s.point);
    prev = s.point ?? prev;
  }
  return cost;
}

function nearestNeighbour(start: Pt | null, items: StopInput[], dist: DistFn): StopInput[] {
  const left = [...items];
  const out: StopInput[] = [];
  let cur = start;
  while (left.length) {
    let best = 0;
    if (cur) {
      let bestD = Infinity;
      left.forEach((s, i) => {
        const d = dist(cur!, s.point!);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
    }
    const [s] = left.splice(best, 1);
    out.push(s);
    cur = s.point;
  }
  return out;
}

function twoOpt(start: Pt | null, seq: StopInput[], dist: DistFn): StopInput[] {
  if (seq.length < 3) return seq;
  let best = seq;
  let bestCost = pathCost(start, best, dist);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const c = pathCost(start, cand, dist);
        if (c + 1e-9 < bestCost) {
          best = cand;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return best;
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);

export function suggestOrder(origin: Pt | null, stops: StopInput[], dist: DistFn = haversineKm, distLabel = "en línea recta"): Suggestion {
  const groups = new Map<number, StopInput[]>();
  for (const s of stops) {
    const k = slotStart(s.slot) ?? Number.MAX_SAFE_INTEGER;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const keys = [...groups.keys()].sort((a, b) => a - b);
  const ordered: StopInput[] = [];
  const reasons: Record<string, string> = {};
  let cur = origin;

  for (const k of keys) {
    const g = groups.get(k)!;
    const located = g.filter((s) => s.point);
    const unlocated = g.filter((s) => !s.point);
    const pri = twoOpt(cur, nearestNeighbour(cur, located.filter((s) => s.priority), dist), dist);
    const afterPri = pri.length ? pri[pri.length - 1].point : cur;
    const rest = twoOpt(afterPri, nearestNeighbour(afterPri, located.filter((s) => !s.priority), dist), dist);
    for (const s of [...pri, ...rest]) {
      const parts: string[] = [];
      if (k !== Number.MAX_SAFE_INTEGER && s.slot) parts.push(`Franja ${s.slot}`);
      if (s.priority) parts.push("marcada como prioritaria");
      if (cur && s.point) {
        const km = haversineKm(cur, s.point);
        parts.push(
          `${ordered.length ? "cerca de la parada anterior" : origin ? "la más cercana al punto de salida" : "primera de la lista"} (≈ ${fmtKm(km)} ${distLabel}${s.approx ? ", ubicación aproximada de la localidad" : ""})`,
        );
      } else if (!cur) {
        parts.push("sin punto de salida conocido: orden por cercanía entre paradas");
      }
      reasons[s.id] = parts.join(" · ");
      ordered.push(s);
      cur = s.point ?? cur;
    }
    for (const s of unlocated) {
      reasons[s.id] = `${k !== Number.MAX_SAFE_INTEGER && s.slot ? `Franja ${s.slot} · ` : ""}sin ubicación conocida: colócala a mano si hace falta`;
      ordered.push(s);
    }
  }

  const allLocated = ordered.every((s) => s.point);
  const totalKm = allLocated && ordered.length ? pathCost(origin, ordered, haversineKm) : null;
  return { order: ordered.map((s) => s.id), reasons, totalKm };
}
