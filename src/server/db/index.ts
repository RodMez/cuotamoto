import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "node:fs";
import path from "node:path";

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function resolveDbPath() {
  return process.env.DATABASE_URL?.replace("file:", "") ?? "./data/prod.db";
}

type RealDrizzle = ReturnType<typeof drizzle>;

// UNA sola conexión compartida por proceso.
// En build (Collecting page data) NO se abre SQLite: evita SIGSEGV en ARM
// y evita crear archivos durante `next build`. Las páginas son force-dynamic,
// así que este dummy nunca se consulta en build.
function createDummyDb(): RealDrizzle {
  const sqliteStub = {
    pragma() {},
    exec() {},
    prepare: () => ({ all: () => [], get: () => undefined, run: () => ({}) }),
  };
  return drizzle(sqliteStub as unknown as InstanceType<typeof Database>, { schema });
}

let handle: InstanceType<typeof Database> | null = null;

function getHandle(): InstanceType<typeof Database> {
  if (isBuildPhase) {
    throw new Error("SQLite no disponible durante el build (NEXT_PHASE)");
  }
  if (!handle) {
    const dbPath = resolveDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    handle = new Database(dbPath);
    handle.pragma("journal_mode = WAL");
    handle.pragma("foreign_keys = ON");
  }
  return handle;
}

/** drizzle sobre la conexión única. */
export const db: RealDrizzle = isBuildPhase
  ? createDummyDb()
  : drizzle(getHandle(), { schema });

/** Acceso al handle crudo (backup online, scripts). Misma conexión, no otra. */
export function getSqlite(): InstanceType<typeof Database> {
  return getHandle();
}
