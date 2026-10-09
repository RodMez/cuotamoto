import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireRole: vi.fn(), identity: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireRole: authMocks.requireRole,
  identity: authMocks.identity,
}));

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { vehicles } from "@/server/db/schema";
import { GET, POST } from "@/app/api/vehicles/route";
import {
  auditByAccion,
  migrateTestDb,
  mkClient,
  mkContract,
  mkUser,
  mkVehicle,
} from "./helpers";

const ADMIN = { id: "u-test-admin", rol: "admin" } as const;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/vehicles", {
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

describe("GET /api/vehicles", () => {
  it("401 si no hay usuario autenticado", async () => {
    authMocks.identity.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("no auth");
  });

  it("admin/cobrador/viewer recibe todas las motos, contratos y clientes", async () => {
    const vId = await mkVehicle();
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rol).toBe("admin");
    expect(Array.isArray(json.vehicles)).toBe(true);
    expect(Array.isArray(json.contracts)).toBe(true);
    expect(Array.isArray(json.clients)).toBe(true);
    expect(json.vehicles.some((v: { id: string }) => v.id === vId)).toBe(true);
  });

  it("conductor solo ve los vehículos y contratos vinculados a su ficha", async () => {
    const uConductor = await mkUser("conductor");
    const cConductor = await mkClient({ userId: uConductor });
    const vConductor = await mkVehicle(18000);
    const ctConductor = await mkContract(vConductor, cConductor, { inicio: "2026-10-01" });

    // Otro vehículo y contrato de otro usuario
    const vOtro = await mkVehicle(20000);
    const cOtro = await mkClient();
    await mkContract(vOtro, cOtro, { inicio: "2026-10-01" });

    authMocks.identity.mockResolvedValue({ id: uConductor, rol: "conductor" });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rol).toBe("conductor");
    expect(json.vehicles.map((v: { id: string }) => v.id)).toEqual([vConductor]);
    expect(json.contracts.map((c: { id: string }) => c.id)).toEqual([ctConductor]);
    expect(json.clients.map((c: { id: string }) => c.id)).toEqual([cConductor]);
  });

  it("conductor sin ficha de cliente vinculada recibe listas vacías", async () => {
    const uSinFicha = await mkUser("conductor");
    authMocks.identity.mockResolvedValue({ id: uSinFicha, rol: "conductor" });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rol).toBe("conductor");
    expect(json.vehicles).toEqual([]);
    expect(json.contracts).toEqual([]);
    expect(json.clients).toEqual([]);
  });
});

describe("POST /api/vehicles", () => {
  it("401/403 si el rol no es admin", async () => {
    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "no auth" }, { status: 401 }),
    );
    expect((await post({ placa: "ABC-123", cuotaBase: 15000 })).status).toBe(401);
    expect(authMocks.requireRole).toHaveBeenCalledWith("admin");

    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "sin permiso" }, { status: 403 }),
    );
    expect((await post({ placa: "ABC-123", cuotaBase: 15000 })).status).toBe(403);
    expect(authMocks.requireRole).toHaveBeenCalledWith("admin");
  });

  it("400 con placa faltante o vacía, y cuotaBase no entera o menor/igual a 0", async () => {
    const casosInvalidos = [
      {},
      { placa: "" },
      { placa: "   ", cuotaBase: 15000 },
      { placa: "ABC-123" },
      { placa: "ABC-123", cuotaBase: 0 },
      { placa: "ABC-123", cuotaBase: -1000 },
      { placa: "ABC-123", cuotaBase: 15000.5 },
      { placa: "ABC-123", cuotaBase: "quince mil" },
    ];

    for (const caso of casosInvalidos) {
      const res = await post(caso);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("placa y cuotaBase válidos");
    }
  });

  it("crea el vehículo normalizando la placa y registra auditoría", async () => {
    const placaRaw = `  xyz-${Date.now().toString(36)}  `;
    const placaExpected = placaRaw.trim().toUpperCase();

    const res = await post({
      placa: placaRaw,
      alias: "Moto de Prueba",
      cuotaBase: 16500,
    });

    expect(res.status).toBe(200);
    expect(authMocks.requireRole).toHaveBeenCalledWith("admin");
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.vehicle.placa).toBe(placaExpected);
    expect(json.vehicle.alias).toBe("Moto de Prueba");
    expect(json.vehicle.cuotaBase).toBe(16500);
    expect(json.vehicle.activa).toBe(1);

    const rows = await db.select().from(vehicles).where(eq(vehicles.id, json.vehicle.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].placa).toBe(placaExpected);

    const logs = await auditByAccion("crear_vehiculo");
    expect(logs.some((l) => l.entidadId === json.vehicle.id)).toBe(true);
  });

  it("409 si la placa ya existe", async () => {
    const placaUnica = `DUP-${Date.now().toString(36).toUpperCase()}`;
    const res1 = await post({ placa: placaUnica, cuotaBase: 15000 });
    expect(res1.status).toBe(200);

    const res2 = await post({ placa: placaUnica.toLowerCase(), cuotaBase: 17000 });
    expect(res2.status).toBe(409);
    const json = await res2.json();
    expect(json.error).toBe("placa ya existe");
  });
});
