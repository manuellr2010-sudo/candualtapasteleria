import "server-only";
import { all, newId, nowIso, run } from "./db";
import type { LogEntry } from "./types";

/**
 * Registro de incidencias en lenguaje claro (pagos, mensajería, reparto).
 * `detail` guarda información técnica sin datos personales ni secretos.
 */
export async function logEvent(level: LogEntry["level"], source: string, message: string, detail = "") {
  try {
    await run(`INSERT INTO logs (id, level, source, message, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [
      newId(),
      level,
      source,
      message,
      detail.slice(0, 2000),
      nowIso(),
    ]);
  } catch (e) {
    console.error("[log]", message, e);
  }
}

export async function recentLogs(limit = 100): Promise<LogEntry[]> {
  const rows = await all<Record<string, unknown>>(`SELECT * FROM logs ORDER BY created_at DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({
    id: String(r.id),
    level: r.level as LogEntry["level"],
    source: String(r.source),
    message: String(r.message),
    detail: String(r.detail ?? ""),
    createdAt: String(r.created_at),
  }));
}
