import { auth } from "@/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { Role } from "./db/schema";

export type Identity = { id: string; rol: Role };

/**
 * Sesión con rol REVALIDADO desde la DB (el JWT puede estar viejo).
 * Devuelve null si: no hay sesión, el usuario ya no existe, está
 * desactivado (activo=0), o su tokenVersion cambió (clave restablecida
 * o reactivación: las sesiones viejas mueren al instante).
 * Las rutas responden 401/403 con esto; proxy.ts solo hace routing.
 */
export async function identity(): Promise<Identity | null> {
  const s = await auth();
  const sessUser = s?.user as unknown as { id?: string; tokenVersion?: number } | undefined;
  const sub = sessUser?.id;
  if (!s?.user || !sub) return null;
  const rows = await db
    .select({ id: users.id, rol: users.rol, activo: users.activo, tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, sub))
    .limit(1);
  const u = rows[0];
  if (!u) return null;
  if ((u.activo ?? 1) === 0) return null;
  if ((sessUser.tokenVersion ?? 0) !== (u.tokenVersion ?? 0)) return null;
  return { id: u.id, rol: u.rol as Role };
}

/** Exige uno de los roles; lanza Response 401/403 lista para retornar. */
export async function requireRole(...allowed: Role[]): Promise<Identity> {
  const me = await identity();
  if (!me) throw Response.json({ error: "no auth" }, { status: 401 });
  if (!allowed.includes(me.rol))
    throw Response.json({ error: "sin permiso" }, { status: 403 });
  return me;
}
