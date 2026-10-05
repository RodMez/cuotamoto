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

// En build (Collecting page data) NO abrimos SQLite: evita SIGSEGV en ARM
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

function createRealDb(): RealDrizzle {
  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

// Necesario para seed/scripts que usan `sqlite` directo: solo en runtime.
function createRealSqlite() {
  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export const db: RealDrizzle = isBuildPhase ? createDummyDb() : createRealDb();
// `sqlite` solo existe en runtime; en build es un stub tipado como any.
export const sqlite: InstanceType<typeof Database> = (
  isBuildPhase ? createDummyDb() as unknown : createRealSqlite()
) as InstanceType<typeof Database>;
