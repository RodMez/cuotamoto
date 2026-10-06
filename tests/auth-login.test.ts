import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { loginAttempts, users, type Role } from "@/server/db/schema";
import {
  authorizeLogin,
  BLOQUEO_MS,
  jwtCallback,
  MAX_INTENTOS,
  sessionCallback,
} from "@/server/login";
import { migrateTestDb } from "./helpers";
import { nowISO } from "@/lib/utils";

// Rate-limit y login contra DB real. Hash con pocas rondas: rápido y válido.

const tag = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

async function mkLoginUser(password: string, rol: Role = "cobrador") {
  const k = tag();
  const email = `login-${k}@test.local`;
  const telefono = `311${k}`.slice(0, 12);
  const id = "u" + k;
  await db.insert(users).values({
    id,
    name: "Login Test",
    email,
    telefono,
    passwordHash: await bcrypt.hash(password, 4),
    rol,
    createdAt: nowISO(),
  });
  return { id, email, telefono };
}

function intentoDe(ident: string) {
  return db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identificador, ident))
    .then((r) => r[0]);
}

beforeAll(() => {
  migrateTestDb();
});

describe("authorizeLogin: éxito", () => {
  it("entra por email (case-insensitive, con trim) y por teléfono", async () => {
    const u = await mkLoginUser("clave-secreta-1");
    const porEmail = await authorizeLogin({ identificador: `  ${u.email.toUpperCase()}  `, password: "clave-secreta-1" });
    expect(porEmail?.id).toBe(u.id);
    expect(porEmail?.rol).toBe("cobrador");
    expect(porEmail?.telefono).toBe(u.telefono);

    const porTel = await authorizeLogin({ identificador: u.telefono, password: "clave-secreta-1" });
    expect(porTel?.id).toBe(u.id);
  });

  it("null con credenciales vacías", async () => {
    expect(await authorizeLogin({ identificador: "", password: "x" })).toBeNull();
    expect(await authorizeLogin({ identificador: "a@b.c" })).toBeNull();
    expect(await authorizeLogin(undefined)).toBeNull();
  });
});

describe("authorizeLogin: intentos y bloqueo", () => {
  it("clave mala suma intentos (insert y luego update)", async () => {
    const u = await mkLoginUser("buena-1234");
    expect(await authorizeLogin({ identificador: u.email, password: "mala" })).toBeNull();
    expect((await intentoDe(u.email))?.intentos).toBe(1);
    expect(await authorizeLogin({ identificador: u.email, password: "mala" })).toBeNull();
    expect((await intentoDe(u.email))?.intentos).toBe(2);
  });

  it(`a los ${MAX_INTENTOS} fallos bloquea ${BLOQUEO_MS / 60000} min incluso con clave buena`, async () => {
    const u = await mkLoginUser("buena-1234");
    for (let i = 0; i < MAX_INTENTOS; i++) {
      expect(await authorizeLogin({ identificador: u.email, password: "mala" })).toBeNull();
    }
    const row = await intentoDe(u.email);
    expect(row?.intentos).toBe(MAX_INTENTOS);
    expect(row?.bloqueadoHasta).toBeDefined();
    expect(new Date(row!.bloqueadoHasta!).getTime()).toBeGreaterThan(Date.now());

    // Misma respuesta null con la clave correcta: no revela el bloqueo.
    expect(await authorizeLogin({ identificador: u.email, password: "buena-1234" })).toBeNull();
  });

  it("bloqueo vencido reinicia la ventana (entra con clave buena)", async () => {
    const u = await mkLoginUser("buena-1234");
    for (let i = 0; i < MAX_INTENTOS; i++) {
      await authorizeLogin({ identificador: u.email, password: "mala" });
    }
    await db
      .update(loginAttempts)
      .set({ bloqueadoHasta: new Date(Date.now() - 1000).toISOString() })
      .where(eq(loginAttempts.identificador, u.email));

    const ok = await authorizeLogin({ identificador: u.email, password: "buena-1234" });
    expect(ok?.id).toBe(u.id);
    expect(await intentoDe(u.email)).toBeUndefined();
  });

  it("el éxito limpia intentos previos", async () => {
    const u = await mkLoginUser("buena-1234");
    await authorizeLogin({ identificador: u.email, password: "mala" });
    await authorizeLogin({ identificador: u.email, password: "mala" });
    expect((await intentoDe(u.email))?.intentos).toBe(2);
    expect((await authorizeLogin({ identificador: u.email, password: "buena-1234" }))?.id).toBe(
      u.id,
    );
    expect(await intentoDe(u.email)).toBeUndefined();
  });

  it("usuario inexistente: mismo null + fila de intento (no enumera cuentas)", async () => {
    const ident = `nadie-${tag()}@test.local`;
    expect(await authorizeLogin({ identificador: ident, password: "cualquiera" })).toBeNull();
    expect((await intentoDe(ident))?.intentos).toBe(1);
  });

  it("purga oportunista: borra filas de >24h aunque sean de otro identificador", async () => {
    const u = await mkLoginUser("buena-1234");
    const viejo = `viejo-${tag()}@test.local`;
    await db.insert(loginAttempts).values({
      identificador: viejo,
      intentos: 1,
      bloqueadoHasta: null,
      actualizadoEn: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    await authorizeLogin({ identificador: u.email, password: "buena-1234" });
    expect(await intentoDe(viejo)).toBeUndefined();
  });
});

describe("jwtCallback / sessionCallback", () => {
  it("jwt propaga rol y teléfono solo cuando hay user", async () => {
    const conUser = await jwtCallback({ token: {}, user: { rol: "admin", telefono: "300" } });
    expect(conUser).toMatchObject({ rol: "admin", telefono: "300" });

    const sinUser = await jwtCallback({ token: { a: 1 } });
    expect(sinUser).toEqual({ a: 1 });
  });

  it("session expone rol, teléfono e id (desde sub)", async () => {
    const out = await sessionCallback({
      session: { user: {}, expires: "x" },
      token: { rol: "conductor", telefono: "311", sub: "u-9" },
    });
    expect(out.user).toMatchObject({ rol: "conductor", telefono: "311", id: "u-9" });
  });
});
