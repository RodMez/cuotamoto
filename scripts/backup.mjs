// Backup online y consistente (WAL-safe) con la API de better-sqlite3.
// Destino FUERA del volumen de datos: BACKUP_DIR (ej. /backups en Coolify,
// montado como volumen aparte). Retención: últimos 7 archivos.
import fs from "node:fs";
import path from "node:path";

const rawUrl = process.env.DATABASE_URL || "file:/app/data/prod.db";
let dbPath = rawUrl;
if (dbPath.startsWith("file:")) dbPath = dbPath.slice(5);
const q = dbPath.indexOf("?");
if (q !== -1) dbPath = dbPath.slice(0, q);

const backupDir = process.env.BACKUP_DIR || "/backups";
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

if (!fs.existsSync(dbPath)) {
  console.error(`[backup] ERROR: no existe la DB ${dbPath}`);
  process.exit(1);
}

const { default: Database } = await import("better-sqlite3");
const sqlite = new Database(dbPath, { readonly: true, timeout: 10000 });
const fecha = new Date().toISOString().slice(0, 10);
const dest = path.join(backupDir, `cuotamoto-${fecha}.db`);

try {
  await sqlite.backup(dest);
  console.log(`[backup] ${dbPath} -> ${dest}`);
} finally {
  sqlite.close();
}

// Retención: conserva los 7 más recientes
const files = fs
  .readdirSync(backupDir)
  .filter((f) => f.startsWith("cuotamoto-") && f.endsWith(".db"))
  .map((f) => path.join(backupDir, f))
  .sort();
while (files.length > 7) {
  const viejo = files.shift();
  fs.unlinkSync(viejo);
  console.log(`[backup] eliminado ${viejo}`);
}
