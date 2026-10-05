import { auth } from "@/auth";
import { db } from "@/server/db";
import { contracts, vehicles, clients } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const s = await auth();
  const rol = (s?.user as unknown as { rol?: string } | undefined)?.rol as string;
  if (rol !== "admin" && rol !== "cobrador")
    return Response.json({ error: "sin permiso" }, { status: 403 });
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
    createdAt: nowISO(),
  };
  await db.insert(contracts).values(row);
  return Response.json({ ok: true, contract: row });
}
