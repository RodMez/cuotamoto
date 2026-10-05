import { auth } from "@/auth";
import { db } from "@/server/db";
import { payments, contracts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { uid, nowISO, hoyBogota, esFechaValida } from "@/lib/utils";
import { ensureDays } from "@/server/db/ensure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments {contractId, fecha, monto, metodo?, nota?}
// Invariante: ningún pago sin día. Si el día no existe, se genera
// (faltantes hasta esa fecha, exentos incluidos) en la misma operación.
export async function POST(req: Request) {
  const s = await auth();
  const rol = (s?.user as unknown as { rol?: string } | undefined)?.rol as string;
  if (rol !== "admin" && rol !== "cobrador")
    return Response.json({ error: "sin permiso" }, { status: 403 });
  const b = await req.json();
  const monto = Number(b.monto);
  const contractId = String(b.contractId ?? "");
  const fecha = String(b.fecha ?? "");
  if (!contractId || !fecha || !Number.isInteger(monto) || monto <= 0)
    return Response.json({ error: "contractId, fecha y monto>0" }, { status: 400 });
  if (!esFechaValida(fecha))
    return Response.json({ error: "fecha inválida (YYYY-MM-DD)" }, { status: 400 });

  const ct = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!ct[0]) return Response.json({ error: "contrato no existe" }, { status: 404 });
  if (fecha < ct[0].fechaInicio)
    return Response.json({ error: "fecha anterior al inicio del contrato" }, { status: 400 });
  if (rol === "cobrador" && fecha > hoyBogota())
    return Response.json({ error: "fecha futura no permitida" }, { status: 400 });

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
    createdBy: (s?.user as unknown as { id: string } | undefined)?.id ?? null,
    createdAt: nowISO(),
  };
  await db.insert(payments).values(row);
  return Response.json({ ok: true, payment: row });
}

// DELETE /api/payments?id=xxx (solo admin)
export async function DELETE(req: Request) {
  const s = await auth();
  if ((s?.user as unknown as { rol?: string })?.rol !== "admin") return Response.json({ error: "solo admin" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
  await db.delete(payments).where(eq(payments.id, id));
  return Response.json({ ok: true });
}
