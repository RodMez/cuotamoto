import NextAuth from "next-auth";
import type { User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeLogin, jwtCallback, sessionCallback } from "@/server/login";

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
        // Lógica real en @/server/login (testeable sin NextAuth).
        return (await authorizeLogin(c)) as unknown as User | null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      return jwtCallback({ token, user });
    },
    async session({ session, token }) {
      return sessionCallback({ session, token });
    },
  },
  pages: { signIn: "/login" },
});
