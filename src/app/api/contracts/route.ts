import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { contracts, vehicles, clients } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  try {
    await requireRole("admin", "cobrador");
  } catch (res) {
    return res as Response;
  }
  const b = await req.json();
  const vehicleId = String(b.vehicleId ?? "");
  const clientId = String(b.clientId ?? "");
  const fechaInicio = String(b.fechaInicio ?? "");
  if (!vehicleId || !clientId || !fechaInicio)
    return Response.json({ error: "vehicleId, clientId, fechaInicio requeridos" }, { status: 400 });
  if (!FECHA.test(fechaInicio) || Number.isNaN(Date.parse(fechaInicio)))
    return Response.json({ error: "fechaInicio inválida (YYYY-MM-DD)" }, { status: 400 });

  const veh = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!veh[0]) return Response.json({ error: "moto no existe" }, { status: 404 });
  const cli = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!cli[0]) return Response.json({ error: "cliente no existe" }, { status: 404 });

  // Regla producción: 1 contrato activo por moto. Desactiva anteriores.
  await db
    .update(contracts)
    .set({ activo: 0 })
    .where(and(eq(contracts.vehicleId, vehicleId), eq(contracts.activo, 1)));

  const row = {
    id: uid(),
    vehicleId,
    clientId,
    fechaInicio,
    activo: 1,
    saldoInicial:
      b.saldoInicial !== undefined ? Number(b.saldoInicial) : 0,
    omitirDomingos: Number(b.omitirDomingos) === 1 ? 1 : 0,
    createdAt: nowISO(),
  };
  if (!Number.isInteger(row.saldoInicial) || row.saldoInicial < 0)
    return Response.json({ error: "saldoInicial inválido (entero ≥ 0)" }, { status: 400 });
  await db.insert(contracts).values(row);
  return Response.json({ ok: true, contract: row });
}

// PATCH /api/contracts {contractId, saldoInicial?, omitirDomingos?} (solo admin)
// La deuda se recalcula sola porque es derivada.
export async function PATCH(req: Request) {
  try {
    await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const b = await req.json();
  const contractId = String(b.contractId ?? "");
  if (!contractId) return Response.json({ error: "contractId requerido" }, { status: 400 });

  const patch: { saldoInicial?: number; omitirDomingos?: number } = {};
  if (b.saldoInicial !== undefined) {
    const v = Number(b.saldoInicial);
    if (!Number.isInteger(v) || v < 0)
      return Response.json({ error: "saldoInicial inválido (entero ≥ 0)" }, { status: 400 });
    patch.saldoInicial = v;
  }
  if (b.omitirDomingos !== undefined) {
    const v = Number(b.omitirDomingos);
    if (v !== 0 && v !== 1)
      return Response.json({ error: "omitirDomingos debe ser 0 o 1" }, { status: 400 });
    patch.omitirDomingos = v;
  }
  if (Object.keys(patch).length === 0)
    return Response.json({ error: "nada que actualizar" }, { status: 400 });

  await db.update(contracts).set(patch).where(eq(contracts.id, contractId));
  return Response.json({ ok: true });
}
