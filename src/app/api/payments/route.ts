import { auth } from "@/auth";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";

// POST /api/payments {contractId, fecha, monto, metodo?, nota?} -> N pagos por día permitidos
export async function POST(req: Request) {
  const s = await auth();
  const rol = (s?.user as unknown as { rol?: string } | undefined)?.rol as string;
  if (rol !== "admin" && rol !== "cobrador")
    return Response.json({ error: "sin permiso" }, { status: 403 });
  const b = await req.json();
  const monto = Number(b.monto);
  if (!b.contractId || !b.fecha || !Number.isInteger(monto) || monto <= 0)
    return Response.json({ error: "contractId, fecha y monto>0" }, { status: 400 });
  const row = {
    id: uid(),
    contractId: String(b.contractId),
    fecha: String(b.fecha),
    monto,
    metodo: String(b.metodo ?? "efectivo"),
    nota: b.nota ? String(b.nota) : null,
    createdBy: (s?.user as unknown as { id: string } | undefined)?.id ?? null,
    createdAt: nowISO(),
  };
  await db.insert(payments).values(row);
  return Response.json({ ok: true, payment: row });
}

// DELETE /api/payments?id=xxx
export async function DELETE(req: Request) {
  const s = await auth();
  if ((s?.user as unknown as { rol?: string })?.rol !== "admin") return Response.json({ error: "solo admin" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
  await db.delete(payments).where(eq(payments.id, id));
  return Response.json({ ok: true });
}
