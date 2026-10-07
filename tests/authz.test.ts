import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// NextAuth fuera: identity()/requireRole() solo ven auth().
const authMock = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock.auth }));

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { identity, requireRole } from "@/server/authz";
import { migrateTestDb, mkUser } from "./helpers";

function sesion(uid: string | undefined) {
  authMock.auth.mockResolvedValue(
    uid === undefined ? null : { user: { id: uid } },
  );
}

async function statusDe(p: Promise<unknown>): Promise<number> {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(Response);
  return (err as Response).status;
}

beforeAll(() => {
  migrateTestDb();
});

beforeEach(() => {
  authMock.auth.mockReset();
});

describe("identity (rol revalidado desde DB)", () => {
  it("null sin sesión o sin id en la sesión", async () => {
    authMock.auth.mockResolvedValue(null);
    expect(await identity()).toBeNull();
    authMock.auth.mockResolvedValue({});
    expect(await identity()).toBeNull();
    authMock.auth.mockResolvedValue({ user: {} });
    expect(await identity()).toBeNull();
  });

  it("null si el usuario ya no existe (cuenta borrada)", async () => {
    sesion("u-fantasma");
    expect(await identity()).toBeNull();
  });

  it("devuelve id + rol de la DB, ignorando claims viejos del JWT", async () => {
    const id = await mkUser("viewer");
    sesion(id);
    expect(await identity()).toEqual({ id, rol: "viewer" });

    // El rol cambia en DB (JWT viejo diría viewer): la API ve el nuevo.
    await db.update(users).set({ rol: "admin" }).where(eq(users.id, id));
    expect(await identity()).toEqual({ id, rol: "admin" });
  });

  it("null si el usuario está desactivado (401 inmediato)", async () => {
    const id = await mkUser("cobrador");
    sesion(id);
    expect(await identity()).not.toBeNull();
    await db.update(users).set({ activo: 0 }).where(eq(users.id, id));
    expect(await identity()).toBeNull();
    await db.update(users).set({ activo: 1 }).where(eq(users.id, id));
    expect(await identity()).not.toBeNull();
  });

  it("null si tokenVersion cambió (clave restablecida: sesiones viejas mueren)", async () => {
    const id = await mkUser("viewer");
    authMock.auth.mockResolvedValue({ user: { id, tokenVersion: 0 } });
    expect(await identity()).not.toBeNull();
    await db.update(users).set({ tokenVersion: 1 }).where(eq(users.id, id));
    expect(await identity()).toBeNull();
    authMock.auth.mockResolvedValue({ user: { id, tokenVersion: 1 } });
    expect(await identity()).not.toBeNull();
  });
});

describe("requireRole", () => {
  it("lanza 401 sin identidad", async () => {
    authMock.auth.mockResolvedValue(null);
    const p = requireRole("admin");
    expect(await statusDe(p)).toBe(401);
    expect(await (await p.catch((e) => e)).json()).toEqual({ error: "no auth" });
  });

  it("lanza 403 con rol no permitido", async () => {
    const id = await mkUser("cobrador");
    sesion(id);
    expect(await statusDe(requireRole("admin"))).toBe(403);
  });

  it("pasa y devuelve la identidad con rol permitido", async () => {
    const id = await mkUser("cobrador");
    sesion(id);
    await expect(requireRole("admin", "cobrador")).resolves.toEqual({ id, rol: "cobrador" });
  });
});
