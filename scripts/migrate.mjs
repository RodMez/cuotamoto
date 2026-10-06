// migrate.mjs — standalone-friendly (better-sqlite3 + bcryptjs + drizzle-orm, sin TS).
// Lo corre docker-entrypoint.sh antes de `node server.js`.
// 1. Si la DB es legacy (tablas creadas con SQL a mano, sin journal),
//    la normaliza con DDL idempotente y marca la baseline 0000 como aplicada.
// 2. Corre el migrator de drizzle (0001 en adelante).
// 3. Crea el admin inicial si users está vacía (ADMIN_PASSWORD obligatoria ≥12).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rawUrl = process.env.DATABASE_URL || "file:/app/data/prod.db";
let dbPath = rawUrl;
if (dbPath.startsWith("file:")) dbPath = dbPath.slice(5);
const qIdx = dbPath.indexOf("?");
if (qIdx !== -1) dbPath = dbPath.slice(0, qIdx);

console.log(`[migrate] DATABASE_URL=${rawUrl} resolved to ${dbPath}`);

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const { default: Database } = await import("better-sqlite3");
const bcryptNs = await import("bcryptjs");
const bcrypt = bcryptNs.default ?? bcryptNs;
const { drizzle } = await import("drizzle-orm/better-sqlite3");
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");

// DDL idempotente para DBs legacy (creadas antes de drizzle-kit).
// Solo se ejecuta si la DB ya tiene tablas pero ningún journal aplicado.
const LEGACY_DDL = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, telefono TEXT UNIQUE, password_hash TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'viewer', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY, placa TEXT NOT NULL UNIQUE, alias TEXT, cuota_base INTEGER NOT NULL, activa INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, telefono TEXT NOT NULL UNIQUE, documento TEXT, user_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL, client_id TEXT NOT NULL, fecha_inicio TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1, saldo_inicial INTEGER NOT NULL DEFAULT 0, omitir_domingos INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_days (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, dia_seq INTEGER NOT NULL, fecha TEXT NOT NULL, cuota_dia INTEGER NOT NULL, exento INTEGER NOT NULL DEFAULT 0, motivo TEXT, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_day_contract_seq ON ledger_days (contract_id, dia_seq);
CREATE UNIQUE INDEX IF NOT EXISTS uq_day_contract_fecha ON ledger_days (contract_id, fecha);
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, fecha TEXT NOT NULL, monto INTEGER NOT NULL, metodo TEXT NOT NULL DEFAULT 'efectivo', nota TEXT, created_by TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS omisiones (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, fecha TEXT NOT NULL, motivo TEXT, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_omision_contract_fecha ON omisiones (contract_id, fecha);
`;

const sqlite = new Database(dbPath, { timeout: 5000 });
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

try {
  // 1. Baseline para DBs legacy
  const journal = JSON.parse(fs.readFileSync("./drizzle/meta/_journal.json", "utf8"));
  const baseline = journal.entries[0];
  const baselineSql = fs.readFileSync(`./drizzle/${baseline.tag}.sql`, "utf8");
  const baselineHash = crypto.createHash("sha256").update(baselineSql).digest("hex");

  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric)",
  );
  const applied = sqlite
    .prepare("SELECT hash FROM __drizzle_migrations")
    .all()
    .map((r) => r.hash);
  const hasUsers = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();

  if (hasUsers && !applied.includes(baselineHash)) {
    console.log("[migrate] DB legacy detectada: normalizando y marcando baseline aplicada");
    sqlite.exec(LEGACY_DDL);
    // Columnas agregadas tras el SQL manual original
    for (const sql of [
      "ALTER TABLE contracts ADD COLUMN saldo_inicial INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE contracts ADD COLUMN omitir_domingos INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE ledger_days ADD COLUMN exento INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE ledger_days ADD COLUMN motivo TEXT",
    ]) {
      try {
        sqlite.exec(sql);
      } catch {
        // ya existe
      }
    }
    sqlite
      .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
      .run(baselineHash, baseline.when);
  }

  // 2. Migrator de drizzle (0001 en adelante; 0000 en DBs nuevas)
  const db = drizzle(sqlite);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] OK");

  // 2b. Fixups idempotentes de datos (sin cambio de esquema: no van al journal).
  // Si dos emails solo difieren por mayúsculas, normalizar tumbaría el
  // UNIQUE y abortaría el arranque: se avisa y se omite en vez de fallar.
  const choques = sqlite
    .prepare(
      "SELECT lower(email) AS e, count(*) AS n FROM users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1",
    )
    .all();
  if (choques.length > 0) {
    console.error(
      `[migrate] WARN: emails duplicados solo por mayúsculas (${choques.map((c) => c.e).join(", ")}): corrija uno a mano; se omite la normalización`,
    );
  } else {
    const normalizados = sqlite
      .prepare("UPDATE users SET email = lower(email) WHERE email != lower(email)")
      .run();
    if (normalizados.changes > 0) {
      console.log(`[migrate] emails normalizados a minúsculas: ${normalizados.changes}`);
    }
  }

  // 3. Admin inicial
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const row = sqlite.prepare("SELECT COUNT(*) as n FROM users").get();
  if (row.n === 0) {
    const email = process.env.ADMIN_EMAIL ?? "admin@cuotamoto.local";
    const pass = process.env.ADMIN_PASSWORD;
    if (!pass || pass.length < 12) {
      console.error(
        "[migrate] ERROR: ADMIN_PASSWORD obligatoria (mínimo 12 caracteres) para crear el admin inicial",
      );
      process.exit(1);
    }
    const hash = await bcrypt.hash(pass, 10);
    sqlite
      .prepare(
        "INSERT INTO users (id, name, email, telefono, password_hash, rol, created_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run(uid(), "Admin", email, "3000000000", hash, "admin", now());
    console.log(`[migrate] admin creado: ${email}`);
  } else {
    console.log(`[migrate] users existentes: ${row.n}, no se crea admin`);
  }
} catch (error) {
  console.error("[migrate] FAILED", error);
  process.exit(1);
} finally {
  sqlite.close();
}
