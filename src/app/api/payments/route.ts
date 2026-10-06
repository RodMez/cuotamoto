import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { payments, contracts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { uid, nowISO, hoyBogota } from "@/lib/utils";
import { ensureDays } from "@/server/db/ensure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments {contractId, monto, metodo?, nota?}
// Regla: el pago es SIEMPRE hoy (America/Bogota), sin excepciones.
// La fecha del body se ignora. Si el día no existe, se genera en la misma operación.
export async function POST(req: Request) {
  let me;
  try {
    me = await requireRole("admin", "cobrador");
  } catch (res) {
    return res as Response;
  }
  const b = await req.json();
  const monto = Number(b.monto);
  const contractId = String(b.contractId ?? "");
  const fecha = hoyBogota();
  if (!contractId || !Number.isInteger(monto) || monto <= 0)
    return Response.json({ error: "contractId y monto>0" }, { status: 400 });

  const ct = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!ct[0]) return Response.json({ error: "contrato no existe" }, { status: 404 });
  if (fecha < ct[0].fechaInicio)
    return Response.json({ error: "el contrato aún no inicia" }, { status: 400 });

  // Genera el día (y faltantes) si no existe. Mismo invariante que el cron.
  try {
    await ensureDays(contractId, fecha);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  const row = {
    id: uid(),
    contractId,
    fecha,
    monto,
    metodo: String(b.metodo ?? "efectivo"),
    nota: b.nota ? String(b.nota) : null,
    createdBy: me.id,
    createdAt: nowISO(),
  };
  await db.insert(payments).values(row);
  return Response.json({ ok: true, payment: row });
}

// DELETE /api/payments?id=xxx (solo admin)
export async function DELETE(req: Request) {
  try {
    await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
  await db.delete(payments).where(eq(payments.id, id));
  return Response.json({ ok: true });
}
