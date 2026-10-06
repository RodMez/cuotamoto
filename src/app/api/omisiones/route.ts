import { identity, requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { omisiones, contracts, clients, ledgerDays, payments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { uid, nowISO, esFechaValida } from "@/lib/utils";
import { audit } from "@/server/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/omisiones?contractId=xxx (conductor: solo su contrato)
export async function GET(req: Request) {
  const me = await identity();
  if (!me) return Response.json({ error: "no auth" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId") ?? "";
  if (!contractId) return Response.json({ error: "contractId requerido" }, { status: 400 });
  if (me.rol === "conductor") {
    const cts = await db.select().from(contracts).where(eq(contracts.id, contractId));
    if (!cts[0]) return Response.json({ error: "no existe" }, { status: 404 });
    const clis = await db.select().from(clients).where(eq(clients.id, cts[0].clientId));
    if (clis[0]?.userId !== me.id) return Response.json({ error: "no es tu contrato" }, { status: 403 });
  }
  const rows = await db.select().from(omisiones).where(eq(omisiones.contractId, contractId));
  return Response.json({ omisiones: rows });
}

// POST /api/omisiones {contractId, fecha, motivo?} (solo admin, transaccional)
// Si el día ya existe y no tiene pagos, lo convierte a exento (cuota 0).
export async function POST(req: Request) {
  let me;
  try {
    me = await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const b = await req.json();
  const contractId = String(b.contractId ?? "");
  const fecha = String(b.fecha ?? "");
  const motivo = b.motivo ? String(b.motivo) : "Omitido";
  if (!contractId || !fecha) return Response.json({ error: "contractId y fecha" }, { status: 400 });
  if (!esFechaValida(fecha)) return Response.json({ error: "fecha inválida" }, { status: 400 });

  const ct = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!ct[0]) return Response.json({ error: "contrato no existe" }, { status: 404 });
  if (fecha < ct[0].fechaInicio)
    return Response.json({ error: "fecha anterior al inicio" }, { status: 400 });

  const pays = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.contractId, contractId), eq(payments.fecha, fecha)));

  const omiId = uid();
  try {
    db.transaction((tx) => {
      tx.insert(omisiones).values({ id: omiId, contractId, fecha, motivo, createdAt: nowISO() }).run();
      // Si el día ya existe y no tiene pagos, eximirlo en el acto
      if (pays.length === 0) {
        tx.update(ledgerDays)
          .set({ cuotaDia: 0, exento: 1, motivo })
          .where(and(eq(ledgerDays.contractId, contractId), eq(ledgerDays.fecha, fecha)))
          .run();
      }
      audit(tx, {
        userId: me.id, accion: "crear_omision", entidad: "omisiones",
        entidadId: omiId, despues: { contractId, fecha, motivo },
      });
    });
  } catch {
    return Response.json({ error: "fecha ya omitida" }, { status: 409 });
  }
  if (pays.length > 0)
    return Response.json({ ok: true, aviso: "el día tiene pagos: queda registrado pero conserva su cuota" });
  return Response.json({ ok: true });
}

// DELETE /api/omisiones?contractId=&fecha= (solo admin; no toca días ya creados)
export async function DELETE(req: Request) {
  let me;
  try {
    me = await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId") ?? "";
  const fecha = searchParams.get("fecha") ?? "";
  if (!contractId || !fecha) return Response.json({ error: "contractId y fecha" }, { status: 400 });
  const rows = await db
    .select()
    .from(omisiones)
    .where(and(eq(omisiones.contractId, contractId), eq(omisiones.fecha, fecha)));
  if (!rows[0]) return Response.json({ error: "omisión no existe" }, { status: 404 });
  db.transaction((tx) => {
    tx.delete(omisiones)
      .where(and(eq(omisiones.contractId, contractId), eq(omisiones.fecha, fecha)))
      .run();
    audit(tx, {
      userId: me.id, accion: "borrar_omision", entidad: "omisiones",
      entidadId: rows[0].id, antes: rows[0],
    });
  });
  return Response.json({ ok: true });
}
