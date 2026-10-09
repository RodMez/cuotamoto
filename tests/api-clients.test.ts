import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireRole: vi.fn(), identity: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireRole: authMocks.requireRole,
  identity: authMocks.identity,
}));

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { GET, POST } from "@/app/api/clients/route";
import { auditByAccion, migrateTestDb, mkClient, mkUser } from "./helpers";

const ADMIN = { id: "u-test-admin", rol: "admin" } as const;
const COBRADOR = { id: "u-test-cobrador", rol: "cobrador" } as const;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/clients", {
      method: "POST",
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
  authMocks.requireRole.mockResolvedValue(ADMIN);
  authMocks.identity.mockResolvedValue(ADMIN);
});

describe("GET /api/clients", () => {
  it("401 si no hay usuario autenticado", async () => {
    authMocks.identity.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("no auth");
  });

  it("admin/cobrador/viewer recibe todos los clientes", async () => {
    const cId = await mkClient();
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.clients)).toBe(true);
    expect(json.clients.some((c: { id: string }) => c.id === cId)).toBe(true);
  });

  it("conductor solo ve su propia ficha de cliente", async () => {
    const uConductor = await mkUser("conductor");
    const cMio = await mkClient({ userId: uConductor });
    const cOtro = await mkClient();

    authMocks.identity.mockResolvedValue({ id: uConductor, rol: "conductor" });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clients).toHaveLength(1);
    expect(json.clients[0].id).toBe(cMio);
    expect(json.clients.some((c: { id: string }) => c.id === cOtro)).toBe(false);
  });
});

describe("POST /api/clients", () => {
  it("401/403 si el rol no es admin ni cobrador", async () => {
    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "no auth" }, { status: 401 }),
    );
    expect((await post({ nombre: "Carlos", telefono: "3001234567" })).status).toBe(401);
    expect(authMocks.requireRole).toHaveBeenCalledWith("admin", "cobrador");

    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "sin permiso" }, { status: 403 }),
    );
    expect((await post({ nombre: "Carlos", telefono: "3001234567" })).status).toBe(403);
    expect(authMocks.requireRole).toHaveBeenCalledWith("admin", "cobrador");
  });

  it("permite creación tanto por admin como por cobrador", async () => {
    // Admin
    authMocks.requireRole.mockResolvedValue(ADMIN);
    const tel1 = "310" + Math.floor(Math.random() * 1e7);
    const rAdmin = await post({ nombre: "Cliente Admin", telefono: tel1 });
    expect(rAdmin.status).toBe(200);
    expect(authMocks.requireRole).toHaveBeenCalledWith("admin", "cobrador");

    // Cobrador
    authMocks.requireRole.mockResolvedValue(COBRADOR);
    const tel2 = "320" + Math.floor(Math.random() * 1e7);
    const rCobrador = await post({ nombre: "Cliente Cobrador", telefono: tel2 });
    expect(rCobrador.status).toBe(200);
    expect(authMocks.requireRole).toHaveBeenCalledWith("admin", "cobrador");
  });

  it("400 con nombre faltante o teléfono inválido", async () => {
    const casosInvalidos = [
      {},
      { nombre: "" },
      { nombre: "   ", telefono: "3001234567" },
      { nombre: "Pedro" },
      { nombre: "Pedro", telefono: "123" }, // < 7 caracteres
      { nombre: "Pedro", telefono: "abc-xyz" },
    ];

    for (const caso of casosInvalidos) {
      const res = await post(caso);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(typeof json.error).toBe("string");
    }
  });

  it("crea el cliente con documento opcional y registra auditoría", async () => {
    const telUnico = "315" + Math.floor(Math.random() * 1e7);
    const body = {
      nombre: "María Rodríguez",
      telefono: telUnico,
      documento: "CC 12345678",
    };

    const res = await post(body);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.client.nombre).toBe("María Rodríguez");
    expect(json.client.telefono).toBe(telUnico);
    expect(json.client.documento).toBe("CC 12345678");

    const rows = await db.select().from(clients).where(eq(clients.id, json.client.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].nombre).toBe("María Rodríguez");

    const logs = await auditByAccion("crear_cliente");
    expect(logs.some((l) => l.entidadId === json.client.id)).toBe(true);
  });

  it("409 si el teléfono ya existe", async () => {
    const telUnico = "318" + Math.floor(Math.random() * 1e7);
    const r1 = await post({ nombre: "Cliente Original", telefono: telUnico });
    expect(r1.status).toBe(200);

    const r2 = await post({ nombre: "Cliente Repetido", telefono: telUnico });
    expect(r2.status).toBe(409);
    const json = await r2.json();
    expect(json.error).toBe("teléfono ya existe");
  });
});
