import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Decisión pura de routing (sin NextRequest: testeable).
// La frescura del rol se valida en cada API con requireRole().
export type ProxyDecision = { type: "next" } | { type: "redirect"; to: string };

export function decidirRuta(pathname: string, token: { rol?: string } | null): ProxyDecision {
  if (!token) return { type: "redirect", to: "/login" };
  const rol = token.rol;
  if (pathname.startsWith("/admin") && rol !== "admin") {
    return { type: "redirect", to: "/" };
  }
  if (pathname.startsWith("/pendientes") && rol === "conductor") {
    return { type: "redirect", to: "/mi-cuenta" };
  }
  if (pathname.startsWith("/mi-cuenta") && rol !== "conductor") {
    return { type: "redirect", to: "/" };
  }
  return { type: "next" };
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Con AUTH_URL=https, Auth.js usa la cookie __Secure-*: hay que decirlo.
  const secure = (process.env.AUTH_URL ?? "").startsWith("https://");
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie: secure });
  const decision = decidirRuta(
    pathname,
    (token as unknown as { rol?: string } | null) ?? null,
  );
  if (decision.type === "next") return NextResponse.next();
  if (decision.to === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL(decision.to, req.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
