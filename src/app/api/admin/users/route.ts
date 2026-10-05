import { auth } from "@/auth";
import { db } from "@/server/db";
import { users, clients } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { uid, nowISO } from "@/lib/utils";

export const runtime = "nodejs";

// POST /api/admin/users {nombre, telefono, email?, password, rol, clientId?}
// rol conductor -> link a clients via clientId o crea cliente
export async function POST(req: Request) {
  const s = await auth();
  if ((s?.user as unknown as { rol?: string })?.rol !== "admin") return Response.json({ error: "solo admin" }, { status: 403 });
  const b = await req.json();
  const { nombre, telefono, email, password, rol, clientId } = b;
  if (!telefono || !password || !rol)
    return Response.json({ error: "telefono, password, rol requeridos" }, { status: 400 });
  const hash = await bcrypt.hash(String(password), 10);
  const id = uid();
  await db.insert(users).values({
    id,
    name: String(nombre ?? telefono),
    email: email ? String(email) : null,
    telefono: String(telefono),
    passwordHash: hash,
    rol,
    createdAt: nowISO(),
  });
  if (rol === "conductor" && clientId) {
    await db.update(clients).set({ userId: id }).where(eq(clients.id, String(clientId)));
  }
  return Response.json({ ok: true, id });
}
