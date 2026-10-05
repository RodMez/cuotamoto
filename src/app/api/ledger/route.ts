import { auth } from "@/auth";
import { db } from "@/server/db";
import { ledgerDays, contracts, clients } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getLedger } from "@/server/db/ledger";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";

// GET /api/ledger?contractId=xxx -> tabla calculada
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
  const ledger = await getLedger(contractId);
  return Response.json({ ledger });
}

// POST /api/ledger {contractId, fecha, cuotaDia?} -> genera siguiente día
export async function POST(req: Request) {
  const s = await auth();
  const rol = (s?.user as unknown as { rol?: string } | undefined)?.rol as string;
  if (rol !== "admin" && rol !== "cobrador")
    return Response.json({ error: "sin permiso" }, { status: 403 });
  const b = await req.json();
  const contractId = String(b.contractId ?? "");
  const fecha = String(b.fecha ?? ""); // YYYY-MM-DD
  let cuotaDia = b.cuotaDia !== undefined ? Number(b.cuotaDia) : undefined;
  if (!contractId || !fecha) return Response.json({ error: "contractId y fecha" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))
    return Response.json({ error: "fecha inválida (YYYY-MM-DD)" }, { status: 400 });

  const ct = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!ct[0]) return Response.json({ error: "contrato no existe" }, { status: 404 });
  if (fecha < ct[0].fechaInicio)
    return Response.json({ error: "fecha anterior al inicio del contrato" }, { status: 400 });

  const days = await db.select().from(ledgerDays).where(eq(ledgerDays.contractId, contractId));
  const maxSeq = days.reduce((m, d) => Math.max(m, d.diaSeq), 0);
  if (days.some((d) => d.fecha === fecha))
    return Response.json({ error: "ya existe un día con esa fecha" }, { status: 400 });

  if (cuotaDia === undefined) {
    // default: última cuota o 17000
    cuotaDia = days.length ? days[days.length - 1].cuotaDia : 17000;
  }
  if (!Number.isInteger(cuotaDia) || cuotaDia <= 0)
    return Response.json({ error: "cuotaDia inválida" }, { status: 400 });

  const row = {
    id: uid(),
    contractId,
    diaSeq: maxSeq + 1,
    fecha,
    cuotaDia,
    createdAt: nowISO(),
  };
  await db.insert(ledgerDays).values(row);
  return Response.json({ ok: true, day: row });
}
