import { identity, requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { uid, nowISO } from "@/lib/utils";
import { crearClienteSchema } from "@/lib/validators";
import { audit } from "@/server/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/clients -> lista (conductor: solo su ficha)
export async function GET() {
  const me = await identity();
  if (!me) return Response.json({ error: "no auth" }, { status: 401 });
  const all = await db.select().from(clients);
  if (me.rol === "conductor") {
    return Response.json({ clients: all.filter((c) => c.userId === me.id) });
  }
  return Response.json({ clients: all });
}

// POST /api/clients {nombre, telefono, documento?} (admin/cobrador)
export async function POST(req: Request) {
  let me;
  try {
    me = await requireRole("admin", "cobrador");
  } catch (res) {
    return res as Response;
  }
  const parsed = crearClienteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "datos inválidos" },
      { status: 400 },
    );
  const { nombre, telefono, documento } = parsed.data;
  const row = { id: uid(), nombre, telefono, documento: documento ?? null, createdAt: nowISO() };
  try {
    db.transaction((tx) => {
      tx.insert(clients).values(row).run();
      audit(tx, {
        userId: me.id, accion: "crear_cliente", entidad: "clients",
        entidadId: row.id, despues: row,
      });
    });
  } catch {
    return Response.json({ error: "teléfono ya existe" }, { status: 409 });
  }
  return Response.json({ ok: true, client: row });
}
