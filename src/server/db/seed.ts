import { db, getSqlite } from "./index";
import { users, vehicles, clients, contracts, ledgerDays, payments } from "./schema";
import bcrypt from "bcryptjs";
import { uid, nowISO } from "@/lib/utils";

function migrate() {
  getSqlite().exec(`
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
  CREATE TABLE IF NOT EXISTS login_attempts (identificador TEXT PRIMARY KEY, intentos INTEGER NOT NULL DEFAULT 0, bloqueado_hasta TEXT, actualizado_en TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, ts TEXT NOT NULL, user_id TEXT, accion TEXT NOT NULL, entidad TEXT NOT NULL, entidad_id TEXT, antes TEXT, despues TEXT);
  `);
}

async function main() {
  migrate();
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@cuotamoto.local";
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass || adminPass.length < 12) {
    throw new Error("ADMIN_PASSWORD obligatoria (mínimo 12 caracteres) para crear el admin inicial");
  }

  const existing = await db.select().from(users);
  if (existing.length === 0) {
    const hash = await bcrypt.hash(adminPass, 10);
    await db.insert(users).values({
      id: uid(),
      name: "Admin",
      email: adminEmail,
      telefono: "3000000000",
      passwordHash: hash,
      rol: "admin",
      createdAt: nowISO(),
    });
    console.log(`[seed] admin creado: ${adminEmail}`);
  }

  const vehs = await db.select().from(vehicles);
  if (vehs.length === 0) {
    const vId = uid();
    const cId = uid();
    const ctId = uid();
    await db.insert(vehicles).values({
      id: vId,
      placa: "PMO-001",
      alias: "Moto demo",
      cuotaBase: 17000,
      activa: 1,
      createdAt: nowISO(),
    });
    await db.insert(clients).values({
      id: cId,
      nombre: "Conductor demo",
      telefono: "3001112233",
      documento: "123",
      createdAt: nowISO(),
    });
    await db.insert(contracts).values({
      id: ctId,
      vehicleId: vId,
      clientId: cId,
      fechaInicio: "2024-02-01",
      activo: 1,
      createdAt: nowISO(),
    });
    // 3 días demo como tu imagen: 2 pendientes + 1 al día
    const dias = [
      { seq: 89, fecha: "2024-02-09", cuota: 17000, pago: 0 },
      { seq: 90, fecha: "2024-02-10", cuota: 17000, pago: 93000 },
    ];
    for (const d of dias) {
      await db.insert(ledgerDays).values({
        id: uid(),
        contractId: ctId,
        diaSeq: d.seq,
        fecha: d.fecha,
        cuotaDia: d.cuota,
        createdAt: nowISO(),
      });
      if (d.pago > 0) {
        await db.insert(payments).values({
          id: uid(),
          contractId: ctId,
          fecha: d.fecha,
          monto: d.pago,
          metodo: "efectivo",
          nota: "seed",
          createdAt: nowISO(),
        });
      }
    }
    console.log("[seed] datos demo creados");
  }
}

main().then(() => process.exit(0));
