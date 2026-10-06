import { describe, expect, it } from "vitest";
import { decidirRuta } from "@/proxy";

// Decisión pura de routing: sin NextRequest ni cookies.

describe("decidirRuta", () => {
  it("sin token siempre va a /login", () => {
    for (const path of ["/", "/admin", "/pendientes", "/mi-cuenta", "/otra"]) {
      expect(decidirRuta(path, null)).toEqual({ type: "redirect", to: "/login" });
    }
  });

  it("admin pasa en /admin pero no es conductor", () => {
    expect(decidirRuta("/admin", { rol: "admin" })).toEqual({ type: "next" });
    expect(decidirRuta("/admin/usuarios", { rol: "admin" })).toEqual({ type: "next" });
    expect(decidirRuta("/mi-cuenta", { rol: "admin" })).toEqual({ type: "redirect", to: "/" });
    expect(decidirRuta("/pendientes", { rol: "admin" })).toEqual({ type: "next" });
  });

  it("cobrador y viewer: /admin bloqueado, resto según rol", () => {
    for (const rol of ["cobrador", "viewer"]) {
      expect(decidirRuta("/admin", { rol })).toEqual({ type: "redirect", to: "/" });
      expect(decidirRuta("/pendientes", { rol })).toEqual({ type: "next" });
      expect(decidirRuta("/mi-cuenta", { rol })).toEqual({ type: "redirect", to: "/" });
      expect(decidirRuta("/", { rol })).toEqual({ type: "next" });
    }
  });

  it("conductor: /mi-cuenta y redirección desde /pendientes", () => {
    expect(decidirRuta("/mi-cuenta", { rol: "conductor" })).toEqual({ type: "next" });
    expect(decidirRuta("/pendientes", { rol: "conductor" })).toEqual({
      type: "redirect",
      to: "/mi-cuenta",
    });
    expect(decidirRuta("/admin", { rol: "conductor" })).toEqual({ type: "redirect", to: "/" });
  });

  it("token sin rol se trata como no privilegiado", () => {
    expect(decidirRuta("/admin", {})).toEqual({ type: "redirect", to: "/" });
    expect(decidirRuta("/mi-cuenta", {})).toEqual({ type: "redirect", to: "/" });
  });

  it("el match es por prefijo (congela comportamiento actual)", () => {
    expect(decidirRuta("/adminx", { rol: "cobrador" })).toEqual({ type: "redirect", to: "/" });
  });
});
