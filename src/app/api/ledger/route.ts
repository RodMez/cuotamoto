import { auth } from "@/auth";
import { db } from "@/server/db";
import { ledgerDays, contracts, clients, payments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getLedger } from "@/server/db/ledger";
import { ensureDays } from "@/server/db/ensure";
import { hoyBogota, esFechaValida } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ledger?contractId=xxx -> genera faltantes hasta hoy Bogotá y devuelve tabla
export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ error: "no auth" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId");
  if (!contractId) return Response.json({ error: "contractId requerido" }, { status: 400 });

  const rol = (s.user as unknown as { rol: string }).rol as string;
  if (rol === "conductor") {
    const myId = (s.user as unknown as { id: string }).id as string;
    const cts = await db.select().from(contracts).where(eq(contracts.id, contractId));
    const ct = cts[0];
    if (!ct) return Response.json({ error: "no existe" }, { status: 404 });
    const clis = await db.select().from(clients).where(eq(clients.id, ct.clientId));
    if (clis[0]?.userId !== myId) return Response.json({ error: "no es tu contrato" }, { status: 403 });
  }
  // Generación perezosa: días faltantes hasta hoy Bogotá (idempotente)
  try {
    await ensureDays(contractId, hoyBogota());
  } catch {
    // si falla (ej. contrato sin días por fecha futura), se devuelve lo que haya
  }
  const ledger = await getLedger(contractId);
  return Response.json({ ledger });
}

// POST /api/ledger {contractId, fecha, cuotaDia?} -> genera faltantes hasta fecha
// (admin/cobrador). Respeta domingos/omisiones (cuota 0 exento).
export async function POST(req: Request) {
  const s = await auth();
  const rol = (s?.user as unknown as { rol?: string } | undefined)?.rol as string;
  if (rol !== "admin" && rol !== "cobrador")
    return Response.json({ error: "sin permiso" }, { status: 403 });
  const b = await req.json();
  const contractId = String(b.contractId ?? "");
  const fecha = String(b.fecha ?? "");
  if (!contractId || !fecha) return Response.json({ error: "contractId y fecha" }, { status: 400 });
  if (!esFechaValida(fecha)) return Response.json({ error: "fecha inválida (YYYY-MM-DD)" }, { status: 400 });

  if (rol === "cobrador" && fecha > hoyBogota())
    return Response.json({ error: "fecha futura no permitida" }, { status: 400 });

  let creados: number;
  try {
    creados = await ensureDays(contractId, fecha);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  // Cuota manual para la fecha pedida (solo si el día no es exento)
  if (b.cuotaDia !== undefined) {
    const cuotaDia = Number(b.cuotaDia);
    if (!Number.isInteger(cuotaDia) || cuotaDia <= 0)
      return Response.json({ error: "cuotaDia inválida" }, { status: 400 });
    await db
      .update(ledgerDays)
      .set({ cuotaDia })
      .where(
        and(
          eq(ledgerDays.contractId, contractId),
          eq(ledgerDays.fecha, fecha),
          eq(ledgerDays.exento, 0),
        ),
      );
  }
  return Response.json({ ok: true, creados });
}

// PATCH /api/ledger {contractId, fecha, cuotaDia?, nuevaFecha?, motivo?} (solo admin)
export async function PATCH(req: Request) {
  const s = await auth();
  if ((s?.user as unknown as { rol?: string })?.rol !== "admin")
    return Response.json({ error: "solo admin" }, { status: 403 });
  const b = await req.json();
  const contractId = String(b.contractId ?? "");
  const fecha = String(b.fecha ?? "");
  if (!contractId || !fecha) return Response.json({ error: "contractId y fecha" }, { status: 400 });

  const rows = await db
    .select()
    .from(ledgerDays)
    .where(and(eq(ledgerDays.contractId, contractId), eq(ledgerDays.fecha, fecha)));
  const day = rows[0];
  if (!day) return Response.json({ error: "día no existe" }, { status: 404 });

  const pays = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.contractId, contractId), eq(payments.fecha, fecha)));
  const tienePagos = pays.length > 0;

  const patch: Partial<{ cuotaDia: number; fecha: string; motivo: string | null }> = {};
  if (b.cuotaDia !== undefined) {
    const v = Number(b.cuotaDia);
    if (!Number.isInteger(v) || v < 0)
      return Response.json({ error: "cuotaDia inválida (entero ≥ 0)" }, { status: 400 });
    patch.cuotaDia = v;
  }
  if (b.nuevaFecha !== undefined) {
    if (tienePagos)
      return Response.json(
        { error: "el día tiene pagos: borra o mueve los pagos antes de cambiar la fecha" },
        { status: 400 },
      );
    const nf = String(b.nuevaFecha);
    if (!esFechaValida(nf)) return Response.json({ error: "nuevaFecha inválida" }, { status: 400 });
    const dup = await db
      .select({ id: ledgerDays.id })
      .from(ledgerDays)
      .where(and(eq(ledgerDays.contractId, contractId), eq(ledgerDays.fecha, nf)));
    if (dup.length > 0) return Response.json({ error: "ya existe un día con esa fecha" }, { status: 400 });
    patch.fecha = nf;
  }
  if (b.motivo !== undefined) patch.motivo = b.motivo ? String(b.motivo) : null;
  if (Object.keys(patch).length === 0)
    return Response.json({ error: "nada que actualizar" }, { status: 400 });

  await db.update(ledgerDays).set(patch).where(eq(ledgerDays.id, day.id));
  return Response.json({ ok: true });
}

// DELETE /api/ledger?contractId=&fecha= (solo admin, solo sin pagos)
export async function DELETE(req: Request) {
  const s = await auth();
  if ((s?.user as unknown as { rol?: string })?.rol !== "admin")
    return Response.json({ error: "solo admin" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId") ?? "";
  const fecha = searchParams.get("fecha") ?? "";
  if (!contractId || !fecha) return Response.json({ error: "contractId y fecha" }, { status: 400 });

  const pays = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.contractId, contractId), eq(payments.fecha, fecha)));
  if (pays.length > 0)
    return Response.json({ error: "el día tiene pagos: bórralos primero" }, { status: 400 });

  await db
    .delete(ledgerDays)
    .where(and(eq(ledgerDays.contractId, contractId), eq(ledgerDays.fecha, fecha)));
  return Response.json({ ok: true });
}
