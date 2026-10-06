import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Sin DB aquí a propósito: solo claims del JWT para routing.
// La frescura del rol se valida en cada API con requireRole().
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Con AUTH_URL=https, Auth.js usa la cookie __Secure-*: hay que decirlo.
  const secure = (process.env.AUTH_URL ?? "").startsWith("https://");
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie: secure });
  const rol = (token as unknown as { rol?: string } | null)?.rol;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && rol !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/pendientes") && rol === "conductor") {
    return NextResponse.redirect(new URL("/mi-cuenta", req.url));
  }
  if (pathname.startsWith("/mi-cuenta") && rol !== "conductor") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
