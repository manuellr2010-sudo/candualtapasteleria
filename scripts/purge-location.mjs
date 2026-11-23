#!/usr/bin/env node
/**
 * Limpieza de privacidad: borra posiciones de repartos terminados y cierra repartos abandonados.
 * Pensado para ejecutarse a diario (cron) en el servidor:  npm run privacy:purge
 */
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@libsql/client";

const remote = (process.env.DATABASE_URL ?? "").trim();
const file = path.resolve(process.env.DATA_DIR || "./data", "candu.db");
if (!remote && !fs.existsSync(file)) {
  console.log("No hay base de datos todavía: nada que limpiar.");
  process.exit(0);
}
const db = remote
  ? createClient({ url: remote, authToken: process.env.DATABASE_AUTH_TOKEN || undefined })
  : createClient({ url: `file:${file.replace(/\\/g, "/")}` });

const now = new Date();
const staleHours = Number(process.env.STALE_ROUTE_HOURS || 6);
const stale = new Date(now.getTime() - staleHours * 3600_000).toISOString();
const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();

const closed = await db.execute({
  sql: `UPDATE routes SET status='ended', ended_at=?, sharing=0, last_lat=NULL, last_lng=NULL, last_accuracy=NULL, manual_locality=NULL, manual_at=NULL
        WHERE status='active' AND COALESCE(last_at, manual_at, started_at) < ?`,
  args: [now.toISOString(), stale],
});
const wiped = await db.execute({
  sql: `UPDATE routes SET last_lat=NULL, last_lng=NULL, last_accuracy=NULL, last_at=NULL WHERE status='ended' AND last_lat IS NOT NULL AND ended_at < ?`,
  args: [dayAgo],
});
console.log(`Repartos abandonados cerrados: ${closed.rowsAffected}. Ubicaciones antiguas borradas: ${wiped.rowsAffected}.`);
