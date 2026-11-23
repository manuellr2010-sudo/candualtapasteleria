import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient, type Client, type InValue } from "@libsql/client";
import { dataDir, databaseToken, databaseUrl } from "./env";

/**
 * Base de datos: SQLite local (archivo data/candu.db) o libSQL remoto (Turso) si DATABASE_URL existe.
 * Las migraciones son una lista ordenada; cada una se aplica una sola vez.
 */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, mime TEXT NOT NULL,
      original_path TEXT NOT NULL, web_path TEXT, thumb_path TEXT,
      width INTEGER, height INTEGER, bytes INTEGER NOT NULL DEFAULT 0,
      alt TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'upload',
      original_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', price_cents INTEGER,
      status TEXT NOT NULL DEFAULT 'draft', sold_out INTEGER NOT NULL DEFAULT 0,
      units_available INTEGER, category_id TEXT, season_id TEXT,
      order_deadline TEXT, delivery_from TEXT, delivery_to TEXT,
      delivery_note TEXT NOT NULL DEFAULT '', allergen_notes TEXT NOT NULL DEFAULT '',
      media TEXT NOT NULL DEFAULT '[]', source TEXT NOT NULL DEFAULT 'manual',
      source_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, published_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS products_status ON products(status)`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
      delivery_type TEXT NOT NULL, address TEXT, locality TEXT, lat REAL, lng REAL,
      requested_date TEXT, requested_slot TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL, subtotal_cents INTEGER NOT NULL, delivery_fee_cents INTEGER,
      total_cents INTEGER NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT NOT NULL,
      payment_ref TEXT, payment_mode TEXT, whatsapp_consent INTEGER NOT NULL DEFAULT 0,
      consent_at TEXT, priority INTEGER NOT NULL DEFAULT 0, stock_released INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, status_updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS orders_status ON orders(status)`,
    `CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at)`,
    `CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL, type TEXT NOT NULL,
      message TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS order_events_order ON order_events(order_id)`,
    `CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, sharing INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL, ended_at TEXT,
      last_lat REAL, last_lng REAL, last_accuracy REAL, last_at TEXT,
      manual_locality TEXT, manual_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS route_stops (
      route_id TEXT NOT NULL, order_id TEXT NOT NULL, position INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', note TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
      PRIMARY KEY (route_id, order_id))`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, order_id TEXT, channel TEXT NOT NULL, target TEXT NOT NULL,
      status TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY, level TEXT NOT NULL, source TEXT NOT NULL,
      message TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS logs_created ON logs(created_at)`,
  ],
  [
    // Plantilla visual de la ficha, frase corta opcional y alérgenos estructurados (null = sin confirmar).
    `ALTER TABLE products ADD COLUMN template TEXT NOT NULL DEFAULT 'atelier'`,
    `ALTER TABLE products ADD COLUMN tagline TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE products ADD COLUMN allergens TEXT`,
    `ALTER TABLE products ADD COLUMN delivery_slot TEXT NOT NULL DEFAULT ''`,
  ],
];

type G = typeof globalThis & { __canduDb?: Client; __canduDbReady?: Promise<void> };
const g = globalThis as G;

function client(): Client {
  if (!g.__canduDb) {
    const remote = databaseUrl();
    if (remote) {
      g.__canduDb = createClient({ url: remote, authToken: databaseToken() || undefined });
    } else {
      const dir = dataDir();
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, "candu.db").replace(/\\/g, "/");
      g.__canduDb = createClient({ url: `file:${file}` });
    }
  }
  return g.__canduDb;
}

async function migrate(db: Client) {
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`);
  const r = await db.execute(`SELECT version FROM schema_version LIMIT 1`);
  let current = r.rows.length ? Number(r.rows[0].version) : 0;
  if (!r.rows.length) await db.execute(`INSERT INTO schema_version (version) VALUES (0)`);
  if (!remoteDb()) await db.execute("PRAGMA journal_mode = WAL").catch(() => {});
  while (current < MIGRATIONS.length) {
    try {
      await db.batch(MIGRATIONS[current], "write");
    } catch (e) {
      // Dos instancias (p. ej. en Vercel) pueden migrar a la vez: si la columna ya existe, se aplica sentencia a sentencia.
      if (!/duplicate column|already exists/i.test(String(e))) throw e;
      for (const sql of MIGRATIONS[current]) {
        await db.execute(sql).catch((err) => {
          if (!/duplicate column|already exists/i.test(String(err))) throw err;
        });
      }
    }
    current += 1;
    await db.execute({ sql: `UPDATE schema_version SET version = ?`, args: [current] });
  }
}

function remoteDb() {
  return Boolean(databaseUrl());
}

export async function db(): Promise<Client> {
  const c = client();
  if (!g.__canduDbReady) g.__canduDbReady = migrate(c);
  await g.__canduDbReady;
  return c;
}

export type Row = Record<string, unknown>;

export async function all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const r = await (await db()).execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function one<T = Row>(sql: string, args: InValue[] = []): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: InValue[] = []) {
  return (await db()).execute({ sql, args });
}

export function newId(bytes = 9): string {
  return randomBytes(bytes).toString("base64url");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(s: unknown, fallback: T): T {
  if (typeof s !== "string") return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
