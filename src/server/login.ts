import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { users, loginAttempts } from "@/server/db/schema";
import { eq, or, lt } from "drizzle-orm";
import type { Role } from "./db/schema";

export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;
// Hash de una clave que nadie conoce: se compara cuando el usuario no existe
// para que el tiempo de respuesta no revele qué cuentas existen.
const FAKE_HASH = "$2b$10$ocbIMkeZ3KZLRDkBjCXv7uTK2UhfXoTOCrObdpCnPyzWaCAdpR0eO";

export type LoginUser = {
  id: string;
  name: string | null;
  email: string | null;
  rol: Role;
  telefono: string | null;
};

/**
 * Lógica de login con credenciales (extraída del provider de NextAuth para
 * poder probarla). Reglas:
 * - identificador = email o teléfono, case-insensitive, con trim
 * - 5 fallos en la ventana => bloqueo 15 min (misma respuesta null: no revelar)
 * - bloqueo vencido reinicia la ventana (no arrastra contador)
 * - purga oportunista de filas viejas (>24h)
 * - éxito limpia los intentos del identificador
 */
export async function authorizeLogin(c: {
  identificador?: unknown;
  password?: unknown;
} | undefined): Promise<LoginUser | null> {
  const ident = String(c?.identificador ?? "").trim().toLowerCase();
  const pass = String(c?.password ?? "");
  if (!ident || !pass) return null;

  const ahora = new Date();
  let intento: typeof loginAttempts.$inferSelect | undefined = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identificador, ident))
    .limit(1)
    .then((r) => r[0]);
  if (intento?.bloqueadoHasta && new Date(intento.bloqueadoHasta) > ahora) {
    return null; // misma respuesta que credencial mala: no revelar el bloqueo
  }
  if (intento?.bloqueadoHasta) {
    // Bloqueo vencido: la ventana reinicia, no se arrastra el contador
    await db.delete(loginAttempts).where(eq(loginAttempts.identificador, ident));
    intento = undefined;
  }
  // Purga oportunista: filas de identificadores que no reintentan (>24h)
  const ayer = new Date(ahora.getTime() - 24 * 60 * 60 * 1000).toISOString();
  await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.actualizadoEn, ayer))
    .catch(() => {});

  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.email, ident), eq(users.telefono, ident)))
    .limit(1);
  const u = rows[0];
  // Compara siempre (hash falso si no existe) para tiempo uniforme
  const ok = await bcrypt.compare(pass, u?.passwordHash ?? FAKE_HASH);
  if (!u || !ok) {
    const n = (intento?.intentos ?? 0) + 1;
    const bloqueo = n >= MAX_INTENTOS ? new Date(ahora.getTime() + BLOQUEO_MS).toISOString() : null;
    if (intento) {
      await db
        .update(loginAttempts)
        .set({ intentos: n, bloqueadoHasta: bloqueo, actualizadoEn: ahora.toISOString() })
        .where(eq(loginAttempts.identificador, ident));
    } else {
      await db.insert(loginAttempts).values({
        identificador: ident, intentos: n,
        bloqueadoHasta: bloqueo, actualizadoEn: ahora.toISOString(),
      });
    }
    return null;
  }
  // Éxito: limpia intentos
  if (intento) {
    await db.delete(loginAttempts).where(eq(loginAttempts.identificador, ident));
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    rol: u.rol as Role,
    telefono: u.telefono,
  };
}

/** Propaga rol/teléfono del usuario al JWT (primer login). */
export async function jwtCallback<T extends Record<string, unknown>>(args: {
  token: T;
  user?: unknown;
}): Promise<T> {
  const cu = args.user as unknown as { rol?: string; telefono?: string } | undefined;
  if (cu?.rol) (args.token as Record<string, unknown>).rol = cu.rol;
  if (cu?.telefono) (args.token as Record<string, unknown>).telefono = cu.telefono;
  return args.token;
}

/** Expone rol/teléfono/id (desde sub) en la sesión. authz.ts depende de `id`. */
export async function sessionCallback<
  S extends { user: object },
  T extends Record<string, unknown>,
>(args: { session: S; token: T }): Promise<S> {
  const u = args.session.user as Record<string, unknown>;
  u.rol = args.token.rol;
  u.telefono = args.token.telefono;
  u.id = args.token.sub;
  return args.session;
}
