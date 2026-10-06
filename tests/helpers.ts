import { execSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  vehicles,
  clients,
  contracts,
  payments,
  users,
  auditLog,
  type Role,
} from "@/server/db/schema";
import { uid, nowISO } from "@/lib/utils";

/** Asegura esquema en la DB de test (idempotente, vía migrate.mjs). */
export function migrateTestDb() {
  execSync("node scripts/migrate.mjs", { stdio: "pipe" });
}

const s = () =>
  Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

export type FixtureOpts = {
  inicio: string;
  cuotaBase?: number;
  saldoInicial?: number;
  omitirDomingos?: boolean;
};

/** Crea vehículo + cliente + contrato con ids únicos. Devuelve el contractId. */
export async function fixture(opts: FixtureOpts): Promise<string> {
  const v = await mkVehicle(opts.cuotaBase ?? 17000);
  const c = await mkClient();
  return mkContract(v, c, opts);
}

/** Vehículo suelto (para POST /api/contracts). */
export async function mkVehicle(cuotaBase = 17000): Promise<string> {
  const k = s();
  const v = "v" + k;
  await db.insert(vehicles).values({
    id: v,
    placa: "TST-" + k.toUpperCase(),
    cuotaBase,
    activa: 1,
    createdAt: nowISO(),
  });
  return v;
}

/** Cliente suelto, opcionalmente vinculado a un user (conductor). */
export async function mkClient(opts?: { userId?: string }): Promise<string> {
  const k = s();
  const c = "c" + k;
  await db.insert(clients).values({
    id: c,
    nombre: "Test",
    telefono: "399" + k,
    userId: opts?.userId ?? null,
    createdAt: nowISO(),
  });
  return c;
}

/** Contrato suelto sobre vehículo+cliente existentes. */
export async function mkContract(
  vehicleId: string,
  clientId: string,
  opts: FixtureOpts & { activo?: number },
): Promise<string> {
  const ct = "ct" + s();
  await db.insert(contracts).values({
    id: ct,
    vehicleId,
    clientId,
    fechaInicio: opts.inicio,
    activo: opts.activo ?? 1,
    saldoInicial: opts.saldoInicial ?? 0,
    omitirDomingos: opts.omitirDomingos ? 1 : 0,
    createdAt: nowISO(),
  });
  return ct;
}

/** Usuario suelto (para scoping de conductor en GETs). */
export async function mkUser(rol: Role = "viewer"): Promise<string> {
  const k = s();
  const id = "u" + k;
  await db.insert(users).values({
    id,
    name: "Test",
    email: `t-${k}@test.local`,
    telefono: "388" + k,
    passwordHash: "hash-test",
    rol,
    createdAt: nowISO(),
  });
  return id;
}

/** Filas de audit_log por acción (para verificar trazabilidad de las APIs). */
export function auditByAccion(accion: string) {
  return db.select().from(auditLog).where(eq(auditLog.accion, accion));
}

/** Inserta un pago directo (los tests bypassan la API, que siempre usa hoy). */
export async function pay(contractId: string, fecha: string, monto: number) {
  await db.insert(payments).values({
    id: uid(),
    contractId,
    fecha,
    monto,
    metodo: "efectivo",
    createdAt: nowISO(),
  });
}
