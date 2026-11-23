#!/usr/bin/env node
/**
 * Genera la contraseña del panel de Candú.
 *
 *   npm run admin:password            → pide la contraseña y escribe el hash en .env.local
 *   npm run admin:password -- --print → solo muestra las líneas para copiarlas al servidor
 *   npm run admin:password -- --generate → (solo pruebas locales) crea una contraseña aleatoria
 *
 * Nunca se guarda la contraseña en claro: solo un hash scrypt y un secreto de sesión aleatorio.
 */
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const args = new Set(process.argv.slice(2));
const N = 16384, r = 8, p = 1;

function hash(pw) {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${h.toString("base64url")}`;
}

async function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((res) => rl.question(q, (a) => (rl.close(), res(a))));
}

function upsert(file, entries, comment) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const [k, v] of Object.entries(entries)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
  }
  text = text.replace(/^# PRUEBAS_LOCALES.*\n?/m, "");
  if (comment) text += `${comment}\n`;
  fs.writeFileSync(file, text);
}

let password;
let generated = false;
if (args.has("--generate")) {
  password = randomBytes(12).toString("base64url");
  generated = true;
} else {
  password = await ask("Nueva contraseña del panel (mínimo 12 caracteres): ");
  if (!password || password.length < 12) {
    console.error("La contraseña debe tener al menos 12 caracteres.");
    process.exit(1);
  }
}

const out = { ADMIN_PASSWORD_HASH: hash(password), SESSION_SECRET: randomBytes(32).toString("base64url") };

if (args.has("--print")) {
  console.log("\nCopia estas variables en el servidor (no en git):\n");
  for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
  process.exit(0);
}

const file = path.resolve(".env.local");
upsert(file, out, generated ? `# PRUEBAS_LOCALES contraseña generada (no usar en producción): ${password}` : null);
console.log(`\nListo: hash y secreto guardados en ${file}. Reinicia "npm run dev" para aplicarlos.`);
if (generated) console.log("Contraseña de pruebas guardada como comentario en .env.local (solo para este ordenador).");
