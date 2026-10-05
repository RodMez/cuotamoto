import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";

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
        const ident = String(c?.identificador ?? "").trim();
        const pass = String(c?.password ?? "");
        if (!ident || !pass) return null;
        const rows = await db
          .select()
          .from(users)
          .where(or(eq(users.email, ident), eq(users.telefono, ident)))
          .limit(1);
        const u = rows[0];
        if (!u) return null;
        const ok = await bcrypt.compare(pass, u.passwordHash);
        if (!ok) return null;
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
