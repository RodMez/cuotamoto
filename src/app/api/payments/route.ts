import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { payments, contracts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { uid, nowISO, hoyBogota } from "@/lib/utils";
import { ensureDaysInTx } from "@/server/db/ensure";
import { audit } from "@/server/db/audit";

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

  // UNA transacción: día (y faltantes) + pago + auditoría. Nada a medias.
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
  try {
    db.transaction((tx) => {
      ensureDaysInTx(tx, contractId, fecha);
      tx.insert(payments).values(row).run();
      audit(tx, {
        userId: me.id, accion: "crear_pago", entidad: "payments",
        entidadId: row.id, despues: row,
      });
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ ok: true, payment: row });
}

// DELETE /api/payments?id=xxx (solo admin, con auditoría)
export async function DELETE(req: Request) {
  let me;
  try {
    me = await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
  const rows = await db.select().from(payments).where(eq(payments.id, id));
  if (!rows[0]) return Response.json({ error: "pago no existe" }, { status: 404 });
  db.transaction((tx) => {
    tx.delete(payments).where(eq(payments.id, id)).run();
    audit(tx, {
      userId: me.id, accion: "borrar_pago", entidad: "payments",
      entidadId: id, antes: rows[0],
    });
  });
  return Response.json({ ok: true });
}
