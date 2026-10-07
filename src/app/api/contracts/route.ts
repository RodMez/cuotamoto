import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { contracts, vehicles, clients } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { uid, nowISO, esFechaValida } from "@/lib/utils";
import { audit } from "@/server/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let me;
  try {
    me = await requireRole("admin", "cobrador");
  } catch (res) {
    return res as Response;
  }
  const b = await req.json();
  const vehicleId = String(b.vehicleId ?? "");
  const clientId = String(b.clientId ?? "");
  const fechaInicio = String(b.fechaInicio ?? "");
  const saldoInicial = b.saldoInicial !== undefined ? Number(b.saldoInicial) : 0;
  const omitirDomingos = Number(b.omitirDomingos) === 1 ? 1 : 0;
  // TODAS las validaciones ANTES de tocar la DB
  if (!vehicleId || !clientId || !fechaInicio)
    return Response.json({ error: "vehicleId, clientId, fechaInicio requeridos" }, { status: 400 });
  if (!esFechaValida(fechaInicio))
    return Response.json({ error: "fechaInicio inválida (YYYY-MM-DD)" }, { status: 400 });
  if (!Number.isInteger(saldoInicial) || saldoInicial < 0)
    return Response.json({ error: "saldoInicial inválido (entero ≥ 0)" }, { status: 400 });

  const veh = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!veh[0]) return Response.json({ error: "moto no existe" }, { status: 404 });
  const cli = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!cli[0]) return Response.json({ error: "el conductor no existe" }, { status: 404 });

  const row = {
    id: uid(),
    vehicleId,
    clientId,
    fechaInicio,
    activo: 1,
    saldoInicial,
    omitirDomingos,
    createdAt: nowISO(),
  };

  // Desactivar+crear en una transacción (nada a medias).
  db.transaction((tx) => {
    // Regla producción: 1 contrato activo por moto. Desactiva anteriores.
    tx.update(contracts)
      .set({ activo: 0 })
      .where(and(eq(contracts.vehicleId, vehicleId), eq(contracts.activo, 1)))
      .run();
    tx.insert(contracts).values(row).run();
    audit(tx, {
      userId: me.id, accion: "crear_contrato", entidad: "contracts",
      entidadId: row.id, despues: row,
    });
  });
  return Response.json({ ok: true, contract: row });
}

// PATCH /api/contracts {contractId, saldoInicial?, omitirDomingos?} (solo admin)
// La deuda se recalcula sola porque es derivada.
export async function PATCH(req: Request) {
  let me;
  try {
    me = await requireRole("admin");
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

  const antes = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!antes[0]) return Response.json({ error: "contrato no existe" }, { status: 404 });
  db.transaction((tx) => {
    tx.update(contracts).set(patch).where(eq(contracts.id, contractId)).run();
    audit(tx, {
      userId: me.id, accion: "editar_contrato", entidad: "contracts",
      entidadId: contractId, antes: antes[0], despues: patch,
    });
  });
  return Response.json({ ok: true });
}
