import { auth } from "@/auth";
import { db } from "@/server/db";
import { omisiones, contracts, ledgerDays, payments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { uid, nowISO, esFechaValida } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/omisiones?contractId=xxx
export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ error: "no auth" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId") ?? "";
  if (!contractId) return Response.json({ error: "contractId requerido" }, { status: 400 });
  const rows = await db.select().from(omisiones).where(eq(omisiones.contractId, contractId));
  return Response.json({ omisiones: rows });
}

// POST /api/omisiones {contractId, fecha, motivo?} (solo admin)
// Si el día ya existe y no tiene pagos, lo convierte a exento (cuota 0).
export async function POST(req: Request) {
  const s = await auth();
  if ((s?.user as unknown as { rol?: string })?.rol !== "admin")
    return Response.json({ error: "solo admin" }, { status: 403 });
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

  try {
    await db.insert(omisiones).values({ id: uid(), contractId, fecha, motivo, createdAt: nowISO() });
  } catch {
    return Response.json({ error: "fecha ya omitida" }, { status: 409 });
  }

  // Si el día ya existe y no tiene pagos, eximirlo en el acto
  const pays = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.contractId, contractId), eq(payments.fecha, fecha)));
  if (pays.length === 0) {
    await db
      .update(ledgerDays)
      .set({ cuotaDia: 0, exento: 1, motivo })
      .where(and(eq(ledgerDays.contractId, contractId), eq(ledgerDays.fecha, fecha)));
  }
  return Response.json({ ok: true });
}

// DELETE /api/omisiones?contractId=&fecha= (solo admin; no toca días ya creados)
export async function DELETE(req: Request) {
  const s = await auth();
  if ((s?.user as unknown as { rol?: string })?.rol !== "admin")
    return Response.json({ error: "solo admin" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId") ?? "";
  const fecha = searchParams.get("fecha") ?? "";
  if (!contractId || !fecha) return Response.json({ error: "contractId y fecha" }, { status: 400 });
  await db
    .delete(omisiones)
    .where(and(eq(omisiones.contractId, contractId), eq(omisiones.fecha, fecha)));
  return Response.json({ ok: true });
}
