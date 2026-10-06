import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { users, loginAttempts } from "@/server/db/schema";
import { eq, or, lt } from "drizzle-orm";

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
// Hash de una clave que nadie conoce: se compara cuando el usuario no existe
// para que el tiempo de respuesta no revele qué cuentas existen.
const FAKE_HASH = "$2b$10$ocbIMkeZ3KZLRDkBjCXv7uTK2UhfXoTOCrObdpCnPyzWaCAdpR0eO";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "login",
      credentials: {
        identificador: { label: "Email o teléfono" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(c) {
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
          rol: u.rol,
          telefono: u.telefono,
        } as unknown as { id: string; name: string | null; email: string | null };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const cu = user as unknown as { rol?: string; telefono?: string } | undefined;
      if (cu?.rol) (token as unknown as Record<string, unknown>).rol = cu.rol;
      if (cu?.telefono) (token as unknown as Record<string, unknown>).telefono = cu.telefono;
      return token;
    },
    async session({ session, token }) {
      const t = token as unknown as { rol?: string; telefono?: string; sub?: string };
      (session.user as unknown as Record<string, unknown>).rol = t.rol;
      (session.user as unknown as Record<string, unknown>).telefono = t.telefono;
      (session.user as unknown as Record<string, unknown>).id = t.sub;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
