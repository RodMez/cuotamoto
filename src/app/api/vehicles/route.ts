import { identity } from "@/server/authz";
import { db } from "@/server/db";
import { vehicles, contracts, clients } from "@/server/db/schema";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await identity();
  if (!me) return Response.json({ error: "no auth" }, { status: 401 });
  // conductor solo ve su contrato (se filtra en contracts)
  const vehs = await db.select().from(vehicles);
  const cts = await db.select().from(contracts);
  const clis = await db.select().from(clients);
  if (me.rol === "conductor") {
    const myClient = clis.find((c) => c.userId === me.id);
    const myCts = cts.filter((c) => c.clientId === myClient?.id);
    const myVehIds = new Set(myCts.map((c) => c.vehicleId));
    return Response.json({
      vehicles: vehs.filter((v) => myVehIds.has(v.id)),
      contracts: myCts,
      clients: myClient ? [myClient] : [],
    });
  }
  return Response.json({ vehicles: vehs, contracts: cts, clients: clis });
}

export async function POST(req: Request) {
  const me = await identity();
  if (me?.rol !== "admin") return Response.json({ error: "solo admin" }, { status: 403 });
  const b = await req.json();
  const placa = String(b.placa ?? "").trim().toUpperCase();
  const cuotaBase = Number(b.cuotaBase);
  if (!placa || !Number.isInteger(cuotaBase) || cuotaBase <= 0)
    return Response.json({ error: "placa y cuotaBase válidos" }, { status: 400 });
  const row = {
    id: uid(),
    placa,
    alias: String(b.alias ?? ""),
    cuotaBase,
    activa: 1,
    createdAt: nowISO(),
  };
  await db.insert(vehicles).values(row);
  return Response.json({ ok: true, vehicle: row });
}
