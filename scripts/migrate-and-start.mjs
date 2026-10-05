import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const dbPath = (process.env.DATABASE_URL?.replace("file:", "") ?? "/app/data/prod.db").trim();
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const { default: Database } = await import("better-sqlite3");
const bcrypt = (await import("bcryptjs")).default;

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, telefono TEXT UNIQUE, password_hash TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'viewer', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY, placa TEXT NOT NULL UNIQUE, alias TEXT, cuota_base INTEGER NOT NULL, activa INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, telefono TEXT NOT NULL UNIQUE, documento TEXT, user_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL, client_id TEXT NOT NULL, fecha_inicio TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_days (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, dia_seq INTEGER NOT NULL, fecha TEXT NOT NULL, cuota_dia INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_day_contract_seq ON ledger_days (contract_id, dia_seq);
CREATE UNIQUE INDEX IF NOT EXISTS uq_day_contract_fecha ON ledger_days (contract_id, fecha);
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, fecha TEXT NOT NULL, monto INTEGER NOT NULL, metodo TEXT NOT NULL DEFAULT 'efectivo', nota TEXT, created_by TEXT, created_at TEXT NOT NULL);
`);

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const now = () => new Date().toISOString();

const users = sqlite.prepare("SELECT COUNT(*) as n FROM users").get();
if (users.n === 0) {
  const email = process.env.ADMIN_EMAIL ?? "admin@cuotamoto.local";
  const pass = process.env.ADMIN_PASSWORD ?? "admin123";
  const hash = await bcrypt.hash(pass, 10);
  sqlite
    .prepare("INSERT INTO users (id, name, email, telefono, password_hash, rol, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(uid(), "Admin", email, "3000000000", hash, "admin", now());
  console.log(`[init] admin creado: ${email}`);
} else {
  console.log(`[init] users existentes: ${users.n}, no se crea admin`);
}

sqlite.close();
console.log(`[init] DB lista en ${dbPath}, arrancando server.js...`);

const child = spawn("node", ["server.js"], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
