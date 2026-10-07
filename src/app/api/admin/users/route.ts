import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { users, clients, auditLog, payments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { uid, nowISO } from "@/lib/utils";
import { crearUsuarioSchema, editarUsuarioSchema } from "@/lib/validators";
import { audit } from "@/server/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type UsuarioAdmin = {
  id: string;
  name: string | null;
  email: string | null;
  telefono: string | null;
  rol: string;
  activo: number;
  createdAt: string;
  cliente: { id: string; nombre: string } | null;
  borrable: boolean;
};

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

// GET /api/admin/users -> lista con cliente linkeado y flag borrable (solo admin)
export async function GET() {
  let me;
  try {
    me = await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  void me;
  const all = await db.select().from(users);
  const clis = await db.select().from(clients);
  const porUsuario = new Map(clis.filter((c) => c.userId).map((c) => [c.userId as string, c]));
  const lista: UsuarioAdmin[] = [];
  for (const u of all) {
    const aud = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(eq(auditLog.userId, u.id))
      .limit(1);
    const pagos = aud.length
      ? []
      : await db
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.createdBy, u.id))
          .limit(1);
    const cli = porUsuario.get(u.id);
    lista.push({
      id: u.id,
      name: u.name,
      email: u.email,
      telefono: u.telefono,
      rol: u.rol,
      activo: u.activo ?? 1,
      createdAt: u.createdAt,
      cliente: cli ? { id: cli.id, nombre: cli.nombre } : null,
      borrable: aud.length === 0 && pagos.length === 0,
    });
  }
  return Response.json({ users: lista });
}

// PATCH /api/admin/users {userId, nombre?, telefono?, email?, newPassword?, rol?, activo?, clientId?}
// (solo admin). email:null limpia el email; clientId:null deslinkea.
export async function PATCH(req: Request) {
  let me;
  try {
    me = await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const parsed = editarUsuarioSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "datos inválidos" },
      { status: 400 },
    );
  const { userId, nombre, telefono, email, newPassword, rol, activo, clientId } = parsed.data;

  const rows = await db.select().from(users).where(eq(users.id, userId));
  const target = rows[0];
  if (!target) return Response.json({ error: "usuario no existe" }, { status: 404 });

  const esYo = target.id === me.id;
  if (esYo && rol !== undefined && rol !== null && rol !== target.rol)
    return Response.json({ error: "no puedes cambiar tu propio rol" }, { status: 403 });
  if (esYo && activo === 0)
    return Response.json({ error: "no puedes desactivarte a ti mismo" }, { status: 403 });

  const rolFinal = rol ?? target.rol;
  const activoFinal = activo ?? target.activo ?? 1;
  const pierdeAdmin = target.rol === "admin" && (target.activo ?? 1) === 1 &&
    (rolFinal !== "admin" || activoFinal === 0);

  let hash: string | undefined;
  if (newPassword !== undefined && newPassword !== null) {
    hash = await bcrypt.hash(newPassword, 10);
  }

  // clientId: null explícito = deslinkear; string = linkear (solo conductor)
  let linkear: string | null | undefined;
  if (clientId !== undefined) {
    if (clientId === null) {
      linkear = null;
    } else {
      if (rolFinal !== "conductor")
        return Response.json({ error: "solo un conductor puede vincularse" }, { status: 400 });
      const clis = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!clis[0]) return Response.json({ error: "el conductor no existe" }, { status: 404 });
      if (clis[0].userId && clis[0].userId !== target.id)
        return Response.json({ error: "ese conductor ya está vinculado a otro usuario" }, { status: 409 });
      linkear = clientId;
    }
  }

  try {
    db.transaction((tx) => {
      if (pierdeAdmin) {
        const otros = tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.rol, "admin"), eq(users.activo, 1)))
          .all()
          .filter((u) => u.id !== target.id);
        if (otros.length === 0)
          throw new Error("ULTIMO_ADMIN:no puedes dejar el sistema sin administradores activos");
      }
      const patch: Partial<typeof users.$inferInsert> = {};
      if (nombre !== undefined && nombre !== null) patch.name = nombre;
      if (telefono !== undefined && telefono !== null) patch.telefono = telefono;
      if (email !== undefined) patch.email = email;
      if (rol !== undefined && rol !== null) patch.rol = rol;
      if (activo !== undefined && activo !== null) patch.activo = activo;
      if (hash) {
        patch.passwordHash = hash;
        patch.tokenVersion = (target.tokenVersion ?? 0) + 1;
      }
      if (Object.keys(patch).length > 0) {
        tx.update(users).set(patch).where(eq(users.id, target.id)).run();
      }
      if (linkear !== undefined) {
        if (linkear === null) {
          tx.update(clients).set({ userId: null }).where(eq(clients.userId, target.id)).run();
        } else {
          tx.update(clients).set({ userId: target.id }).where(eq(clients.id, linkear)).run();
        }
      }
      audit(tx, {
        userId: me.id, accion: "editar_usuario", entidad: "users",
        entidadId: target.id,
        antes: { rol: target.rol, activo: target.activo, telefono: target.telefono, email: target.email },
        // OJO: no incluir passwordHash ni como undefined — el replacer de
        // audit() convierte cualquier valor de esa clave en "[omitido]".
        despues: {
          ...(patch.rol !== undefined ? { rol: patch.rol } : {}),
          ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
          ...(patch.telefono !== undefined ? { telefono: patch.telefono } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(hash ? { claveRestablecida: true, tokenVersion: patch.tokenVersion } : {}),
          ...(linkear !== undefined ? { clientId: linkear } : {}),
        },
      });
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("ULTIMO_ADMIN:"))
      return Response.json({ error: msg.slice("ULTIMO_ADMIN:".length) }, { status: 409 });
    return Response.json({ error: "email o teléfono ya existe" }, { status: 409 });
  }
  return Response.json({ ok: true });
}

// DELETE /api/admin/users?id= (solo admin)
// Solo sin historial (audit_log.user_id ni payments.created_by). Si tiene,
// 409 "tiene historial, desactívalo".
export async function DELETE(req: Request) {
  let me;
  try {
    me = await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });

  const rows = await db.select().from(users).where(eq(users.id, id));
  const target = rows[0];
  if (!target) return Response.json({ error: "usuario no existe" }, { status: 404 });
  if (target.id === me.id)
    return Response.json({ error: "no puedes borrarte a ti mismo" }, { status: 403 });

  const aud = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(eq(auditLog.userId, id))
    .limit(1);
  const pagos = aud.length
    ? []
    : await db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.createdBy, id))
        .limit(1);
  if (aud.length > 0 || pagos.length > 0)
    return Response.json({ error: "tiene historial, desactívalo en vez de borrarlo" }, { status: 409 });

  try {
    db.transaction((tx) => {
      if (target.rol === "admin" && (target.activo ?? 1) === 1) {
        const otros = tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.rol, "admin"), eq(users.activo, 1)))
          .all()
          .filter((u) => u.id !== target.id);
        if (otros.length === 0)
          throw new Error("ULTIMO_ADMIN:no puedes borrar al último administrador activo");
      }
      tx.update(clients).set({ userId: null }).where(eq(clients.userId, target.id)).run();
      tx.delete(users).where(eq(users.id, target.id)).run();
      audit(tx, {
        userId: me.id, accion: "borrar_usuario", entidad: "users",
        entidadId: target.id,
        antes: { id: target.id, name: target.name, email: target.email, telefono: target.telefono, rol: target.rol },
      });
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("ULTIMO_ADMIN:"))
      return Response.json({ error: msg.slice("ULTIMO_ADMIN:".length) }, { status: 409 });
    throw e;
  }
  return Response.json({ ok: true });
}
