import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { users, clients } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { uid, nowISO } from "@/lib/utils";
import { crearUsuarioSchema } from "@/lib/validators";
import { audit } from "@/server/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/users {nombre, telefono, email?, password, rol, clientId?}
// rol conductor + clientId -> link a clients.userId
export async function POST(req: Request) {
  let me;
  try {
    me = await requireRole("admin");
  } catch (res) {
    return res as Response;
  }

  const parsed = crearUsuarioSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "datos inválidos" },
      { status: 400 },
    );
  const { nombre, telefono, email, password, rol, clientId } = parsed.data;

  const hash = await bcrypt.hash(password, 10);
  const id = uid();
  try {
    db.transaction((tx) => {
      tx.insert(users).values({
        id,
        name: nombre ?? telefono,
        email: email ?? null,
        telefono,
        passwordHash: hash,
        rol,
        createdAt: nowISO(),
      }).run();
      // El hash nunca va al audit (el helper también lo filtra por si acaso)
      audit(tx, {
        userId: me.id, accion: "crear_usuario", entidad: "users",
        entidadId: id, despues: { id, telefono, email: email ?? null, rol },
      });
      if (rol === "conductor" && clientId) {
        tx.update(clients).set({ userId: id }).where(eq(clients.id, clientId)).run();
      }
    });
  } catch {
    return Response.json({ error: "email o teléfono ya existe" }, { status: 409 });
  }
  return Response.json({ ok: true, id });
}
