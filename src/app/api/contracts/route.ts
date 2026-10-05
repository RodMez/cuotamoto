import { auth } from "@/auth";
import { db } from "@/server/db";
import { contracts } from "@/server/db/schema";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await auth();
  const rol = (s?.user as unknown as { rol?: string } | undefined)?.rol as string;
  if (rol !== "admin" && rol !== "cobrador")
    return Response.json({ error: "sin permiso" }, { status: 403 });
  const b = await req.json();
  if (!b.vehicleId || !b.clientId || !b.fechaInicio)
    return Response.json({ error: "vehicleId, clientId, fechaInicio" }, { status: 400 });
  const row = {
    id: uid(),
    vehicleId: String(b.vehicleId),
    clientId: String(b.clientId),
    fechaInicio: String(b.fechaInicio),
    activo: 1,
    createdAt: nowISO(),
  };
  await db.insert(contracts).values(row);
  return Response.json({ ok: true, contract: row });
}
