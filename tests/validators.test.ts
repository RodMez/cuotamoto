import { describe, expect, it } from "vitest";
import {
  crearClienteSchema,
  crearUsuarioSchema,
  emailSchema,
  rolSchema,
  telefonoSchema,
} from "@/lib/validators";

// Zod puro: sin DB.

describe("telefonoSchema", () => {
  it("acepta dígitos, + y espacios (7–15 chars, con trim)", () => {
    expect(telefonoSchema.safeParse("3001234567").success).toBe(true);
    expect(telefonoSchema.safeParse("+57 300 123").success).toBe(true);
    expect(telefonoSchema.safeParse("  3001234  ").success).toBe(true);
  });

  it("rechaza letras, muy cortos y muy largos", () => {
    expect(telefonoSchema.safeParse("abc").success).toBe(false);
    expect(telefonoSchema.safeParse("123456").success).toBe(false); // 6 < 7
    expect(telefonoSchema.safeParse("1".repeat(16)).success).toBe(false);
    expect(telefonoSchema.safeParse("300-1234").success).toBe(false); // guion no permitido
  });
});

describe("rolSchema", () => {
  it("acepta los 4 roles y nada más", () => {
    for (const rol of ["admin", "cobrador", "conductor", "viewer"]) {
      expect(rolSchema.safeParse(rol).success).toBe(true);
    }
    expect(rolSchema.safeParse("superadmin").success).toBe(false);
    expect(rolSchema.safeParse("ADMIN").success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("normaliza a minúsculas y acepta nullish", () => {
    expect(emailSchema.parse("Admin@Test.COM")).toBe("admin@test.com");
    expect(emailSchema.safeParse(null).success).toBe(true);
    expect(emailSchema.safeParse(undefined).success).toBe(true);
  });

  it("rechaza no-emails", () => {
    expect(emailSchema.safeParse("no-es-email").success).toBe(false);
  });
});

describe("crearUsuarioSchema", () => {
  const base = {
    telefono: "3001234567",
    password: "secreta12",
    rol: "cobrador",
  } as const;

  it("acepta payload mínimo válido", () => {
    const r = crearUsuarioSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("exige password ≥ 8 y rol válido", () => {
    expect(crearUsuarioSchema.safeParse({ ...base, password: "corta" }).success).toBe(false);
    expect(crearUsuarioSchema.safeParse({ ...base, password: "1234567" }).success).toBe(false);
    expect(crearUsuarioSchema.safeParse({ ...base, rol: "jefe" }).success).toBe(false);
  });

  it("clientId es opcional (solo conductor lo usa)", () => {
    const r = crearUsuarioSchema.safeParse({ ...base, rol: "conductor", clientId: "ct1" });
    expect(r.success).toBe(true);
    expect(crearUsuarioSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza teléfono inválido y email inválido", () => {
    expect(crearUsuarioSchema.safeParse({ ...base, telefono: "abc" }).success).toBe(false);
    expect(crearUsuarioSchema.safeParse({ ...base, email: "mal" }).success).toBe(false);
  });
});

describe("crearClienteSchema", () => {
  it("acepta nombre + teléfono válidos, documento opcional", () => {
    expect(
      crearClienteSchema.safeParse({ nombre: "Juan", telefono: "3001234567" }).success,
    ).toBe(true);
  });

  it("rechaza nombre vacío y teléfono inválido", () => {
    expect(crearClienteSchema.safeParse({ nombre: "", telefono: "3001234567" }).success).toBe(
      false,
    );
    expect(crearClienteSchema.safeParse({ nombre: "  ", telefono: "3001234567" }).success).toBe(
      false,
    );
    expect(crearClienteSchema.safeParse({ nombre: "Juan", telefono: "12" }).success).toBe(false);
  });
});
