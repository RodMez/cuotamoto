import { db, getSqlite } from "./index";
import { users, vehicles, clients, contracts, ledgerDays, payments } from "./schema";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcrypt from "bcryptjs";
import { uid, nowISO } from "@/lib/utils";

// Dev/local: el esquema lo gobierna drizzle (./drizzle), igual que en prod.
// Así el seed nunca diverge del migrator ni rompe 0001 con "already exists".
async function migrate() {
  drizzleMigrate(drizzle(getSqlite()), { migrationsFolder: "./drizzle" });
}

async function main() {
  await migrate();
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
