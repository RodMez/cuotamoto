import { auth } from "@/auth";
import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rolOf = (s: unknown) =>
  (s as { user?: { rol?: string } } | null)?.user?.rol as string | undefined;

// GET /api/clients -> lista (conductor: solo su ficha)
export async function GET() {
  const s = await auth();
  if (!s?.user) return Response.json({ error: "no auth" }, { status: 401 });
  const all = await db.select().from(clients);
  if (rolOf(s) === "conductor") {
    const myId = (s?.user as unknown as { id: string }).id;
    return Response.json({ clients: all.filter((c) => c.userId === myId) });
  }
  return Response.json({ clients: all });
}

// POST /api/clients {nombre, telefono, documento?} (admin/cobrador)
export async function POST(req: Request) {
  const s = await auth();
  const rol = rolOf(s);
  if (rol !== "admin" && rol !== "cobrador")
    return Response.json({ error: "sin permiso" }, { status: 403 });
  const b = await req.json();
  const nombre = String(b.nombre ?? "").trim();
  const telefono = String(b.telefono ?? "").trim();
  const documento = b.documento ? String(b.documento).trim() : null;
  if (!nombre || !telefono)
    return Response.json({ error: "nombre y teléfono requeridos" }, { status: 400 });
  if (!/^[0-9+ ]{7,15}$/.test(telefono))
    return Response.json({ error: "teléfono inválido" }, { status: 400 });
  const row = { id: uid(), nombre, telefono, documento, createdAt: nowISO() };
  try {
    await db.insert(clients).values(row);
  } catch {
    return Response.json({ error: "teléfono ya existe" }, { status: 409 });
  }
  return Response.json({ ok: true, client: row });
}
