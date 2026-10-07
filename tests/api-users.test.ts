import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireRole: vi.fn(), identity: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireRole: authMocks.requireRole,
  identity: authMocks.identity,
}));

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, clients, payments } from "@/server/db/schema";
import { GET, PATCH, DELETE } from "@/app/api/admin/users/route";
import { auditByAccion, migrateTestDb, mkClient, mkUser } from "./helpers";
import { nowISO, uid } from "@/lib/utils";

const ADMIN = { id: "u-test-admin", rol: "admin" } as const;

function comoAdmin() {
  authMocks.requireRole.mockImplementation(async (...allowed: string[]) => {
    if (!allowed.includes("admin")) throw Response.json({ error: "x" }, { status: 403 });
    return ADMIN;
  });
  authMocks.identity.mockResolvedValue(ADMIN);
}

function como(rol: string, id = "u-otro") {
  authMocks.requireRole.mockImplementation(async (...allowed: string[]) => {
    if (!allowed.includes(rol)) throw Response.json({ error: "x" }, { status: 403 });
    return { id, rol };
  });
  authMocks.identity.mockResolvedValue({ id, rol });
}

async function crear(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(() => {
  migrateTestDb();
});

beforeEach(() => {
  authMocks.requireRole.mockReset();
  authMocks.identity.mockReset();
  comoAdmin();
});

describe("GET /api/admin/users", () => {
  it("lista sin passwordHash, con cliente y borrable", async () => {
    const cli = await mkClient();
    const target = await mkUser("conductor");
    await db.update(clients).set({ userId: target }).where(eq(clients.id, cli));
    const j = await (await GET()).json();
    const fila = j.users.find((u: { id: string }) => u.id === target);
    expect(fila).toBeDefined();
    expect(fila).not.toHaveProperty("passwordHash");
    expect(fila.cliente).toMatchObject({ id: cli });
    expect(fila.borrable).toBe(true);
  });

  it("403 si no eres admin", async () => {
    como("cobrador");
    expect((await GET()).status).toBe(403);
  });
});

describe("PATCH /api/admin/users", () => {
  it("cambia rol y audita editar_usuario", async () => {
    const id = await mkUser("viewer");
    const r = await crear({ userId: id, rol: "cobrador" });
    expect(r.status).toBe(200);
    const rows = await db.select().from(users).where(eq(users.id, id));
    expect(rows[0].rol).toBe("cobrador");
    const aud = await auditByAccion("editar_usuario");
    expect(aud.filter((a) => a.entidadId === id)).toHaveLength(1);
  });

  it("403 al cambiar tu propio rol o desactivarte", async () => {
    const id = await mkUser("admin");
    como("admin", id);
    expect((await crear({ userId: id, rol: "viewer" })).status).toBe(403);
    expect((await crear({ userId: id, activo: 0 })).status).toBe(403);
  });

  it("409 al dejar el sistema sin admins activos (rol y desactivar)", async () => {
    // Solo queda un admin activo en esta DB de test si limpiamos el resto:
    // usamos un admin fresco y degradamos a los demás primero.
    const todos = await db.select({ id: users.id }).from(users).where(eq(users.rol, "admin"));
    for (const a of todos) {
      await db.update(users).set({ rol: "viewer" }).where(eq(users.id, a.id));
    }
    const unico = await mkUser("viewer");
    await db.update(users).set({ rol: "admin" }).where(eq(users.id, unico));
    expect((await crear({ userId: unico, rol: "viewer" })).status).toBe(409);
    expect((await crear({ userId: unico, activo: 0 })).status).toBe(409);
  });

  it("409 con teléfono duplicado, 400 con teléfono inválido tipo 'Ivan'", async () => {
    const a = await mkUser("viewer");
    const b = await mkUser("viewer");
    // mkUser genera teléfonos alfanuméricos: los normalizo a numéricos válidos
    const telA = `300100${String(Date.now()).slice(-4)}`;
    const telB = `300200${String(Date.now()).slice(-4)}`;
    await db.update(users).set({ telefono: telA }).where(eq(users.id, a));
    await db.update(users).set({ telefono: telB }).where(eq(users.id, b));
    expect((await crear({ userId: b, telefono: telA })).status).toBe(409);
    expect((await crear({ userId: b, telefono: "Ivan" })).status).toBe(400);
  });

  it("email:null lo limpia", async () => {
    const id = await mkUser("viewer");
    expect((await crear({ userId: id, email: null })).status).toBe(200);
    const rows = await db.select().from(users).where(eq(users.id, id));
    expect(rows[0].email).toBeNull();
  });

  it("clientId de otro usuario → 409; con rol no-conductor → 400", async () => {
    const cli = await mkClient();
    const dueno = await mkUser("conductor");
    await db.update(clients).set({ userId: dueno }).where(eq(clients.id, cli));
    const otro = await mkUser("conductor");
    expect((await crear({ userId: otro, clientId: cli })).status).toBe(409);
    const cob = await mkUser("cobrador");
    expect((await crear({ userId: cob, clientId: cli })).status).toBe(400);
    // deslinkear sí funciona
    expect((await crear({ userId: dueno, clientId: null })).status).toBe(200);
  });

  it("newPassword sube tokenVersion y nunca va al audit", async () => {
    const id = await mkUser("cobrador");
    const antes = await db.select().from(users).where(eq(users.id, id));
    const hashReal = antes[0].passwordHash;
    expect((await crear({ userId: id, newPassword: "nueva-clave-1" })).status).toBe(200);
    const desp = (await db.select().from(users).where(eq(users.id, id)))[0];
    expect(desp.tokenVersion).toBe((antes[0].tokenVersion ?? 0) + 1);
    expect(desp.passwordHash).not.toBe(hashReal);
    const aud = (await auditByAccion("editar_usuario")).filter((a) => a.entidadId === id);
    expect(aud.length).toBeGreaterThan(0);
    // Ni la clave "passwordHash" ni el hash real aparecen en el audit
    expect(JSON.stringify(aud)).not.toContain("passwordHash");
    expect(JSON.stringify(aud)).not.toContain(hashReal);
  });
});

describe("DELETE /api/admin/users", () => {
  function borrar(id: string) {
    return DELETE(new Request(`http://localhost/api/admin/users?id=${id}`, { method: "DELETE" }));
  }

  it("borra sin historial, deslinkea cliente y audita", async () => {
    const cli = await mkClient();
    const id = await mkUser("conductor");
    await db.update(clients).set({ userId: id }).where(eq(clients.id, cli));
    expect((await borrar(id)).status).toBe(200);
    expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0);
    const c = await db.select().from(clients).where(eq(clients.id, cli));
    expect(c[0].userId).toBeNull();
    expect((await auditByAccion("borrar_usuario")).filter((a) => a.entidadId === id)).toHaveLength(1);
  });

  it("409 con historial (pagos con created_by)", async () => {
    const id = await mkUser("cobrador");
    await db.insert(payments).values({
      id: uid(), contractId: "ct-x", fecha: "2026-10-01", monto: 1000,
      metodo: "efectivo", createdBy: id, createdAt: nowISO(),
    });
    const r = await borrar(id);
    expect(r.status).toBe(409);
    expect(((await r.json()).error as string)).toMatch(/historial/);
  });

  it("403 al borrarte y 409 al borrar al último admin activo", async () => {
    const yo = await mkUser("admin");
    como("admin", yo);
    expect((await borrar(yo)).status).toBe(403);
    // Dejo a `yo` como único admin ACTIVO en DB (los demás, a viewer).
    // El actor `otro` pasa el guard por mock, aunque en DB ya no sea admin.
    const todos = await db.select({ id: users.id }).from(users).where(eq(users.rol, "admin"));
    for (const a of todos.filter((a) => a.id !== yo)) {
      await db.update(users).set({ rol: "viewer" }).where(eq(users.id, a.id));
    }
    const otro = await mkUser("viewer");
    como("admin", otro);
    expect((await borrar(yo)).status).toBe(409);
    // Reactivo a otro como admin para no dejar la DB sin admins (higiene)
    await db.update(users).set({ rol: "admin" }).where(eq(users.id, otro));
  });
});
