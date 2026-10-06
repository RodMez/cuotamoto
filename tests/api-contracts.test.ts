import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireRole: vi.fn(), identity: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireRole: authMocks.requireRole,
  identity: authMocks.identity,
}));

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { contracts } from "@/server/db/schema";
import { getLedger } from "@/server/db/ledger";
import { ensureDays } from "@/server/db/ensure";
import { POST, PATCH } from "@/app/api/contracts/route";
import { auditByAccion, fixture, migrateTestDb, mkClient, mkVehicle } from "./helpers";

const ADMIN = { id: "u-test-admin", rol: "admin" } as const;

function post(body: unknown) {
  return POST(new Request("http://localhost/api/contracts", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

function patch(body: unknown) {
  return PATCH(new Request("http://localhost/api/contracts", {
    method: "PATCH",
    body: JSON.stringify(body),
  }));
}

async function activoDe(id: string) {
  const rows = await db.select().from(contracts).where(eq(contracts.id, id));
  return rows[0]?.activo;
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

describe("POST /api/contracts", () => {
  it("crea el contrato y desactiva el anterior de la misma moto", async () => {
    const v = await mkVehicle();
    const c1 = await mkClient();
    const c2 = await mkClient();

    const j1 = await (await post({ vehicleId: v, clientId: c1, fechaInicio: "2026-09-01" })).json();
    expect(j1.ok).toBe(true);
    expect(await activoDe(j1.contract.id)).toBe(1);

    const r2 = await post({ vehicleId: v, clientId: c2, fechaInicio: "2026-10-01" });
    expect(r2.status).toBe(200);
    const j2 = await r2.json();
    expect(await activoDe(j1.contract.id)).toBe(0);
    expect(await activoDe(j2.contract.id)).toBe(1);

    const rows = await auditByAccion("crear_contrato");
    expect(rows.filter((r) => r.entidadId === j2.contract.id)).toHaveLength(1);
  });

  it("400 con campos faltantes, fecha o saldo inválidos", async () => {
    const v = await mkVehicle();
    const c = await mkClient();
    const casos = [
      { clientId: c, fechaInicio: "2026-09-01" }, // sin moto
      { vehicleId: v, fechaInicio: "2026-09-01" }, // sin cliente
      { vehicleId: v, clientId: c }, // sin fecha
      { vehicleId: v, clientId: c, fechaInicio: "2026-02-31" },
      { vehicleId: v, clientId: c, fechaInicio: "2026-09-01", saldoInicial: -5 },
      { vehicleId: v, clientId: c, fechaInicio: "2026-09-01", saldoInicial: 17.5 },
    ];
    for (const body of casos) {
      expect((await post(body)).status).toBe(400);
    }
  });

  it("404 con moto o cliente inexistentes", async () => {
    const c = await mkClient();
    expect((await post({ vehicleId: "v-no", clientId: c, fechaInicio: "2026-09-01" })).status).toBe(
      404,
    );
    const v = await mkVehicle();
    expect((await post({ vehicleId: v, clientId: "c-no", fechaInicio: "2026-09-01" })).status).toBe(
      404,
    );
  });

  it("401/403 según rol", async () => {
    const v = await mkVehicle();
    const c = await mkClient();
    const body = { vehicleId: v, clientId: c, fechaInicio: "2026-09-01" };
    authMocks.requireRole.mockRejectedValueOnce(Response.json({ error: "no auth" }, { status: 401 }));
    expect((await post(body)).status).toBe(401);
    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "sin permiso" }, { status: 403 }),
    );
    expect((await post(body)).status).toBe(403);
  });
});

describe("PATCH /api/contracts", () => {
  it("ajusta saldoInicial y la deuda derivada se recalcula sola", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    await ensureDays(ct, "2026-09-02"); // 2 × 17k
    const res = await patch({ contractId: ct, saldoInicial: 5000 });
    expect(res.status).toBe(200);
    const L = await getLedger(ct);
    expect(L[L.length - 1].deudaAcumulada).toBe(5000 + 34000);
  });

  it("alterna omitirDomingos", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    expect((await patch({ contractId: ct, omitirDomingos: 1 })).status).toBe(200);
    expect((await db.select().from(contracts).where(eq(contracts.id, ct)))[0].omitirDomingos).toBe(1);
  });

  it("400 con patch vacío o valores inválidos, 404 si no existe", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    expect((await patch({ contractId: ct })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ contractId: ct, saldoInicial: -1 })).status).toBe(400);
    expect((await patch({ contractId: ct, omitirDomingos: 2 })).status).toBe(400);
    expect((await patch({ contractId: "ct-no", saldoInicial: 5 })).status).toBe(404);
  });

  it("solo admin: cobrador recibe 403", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "sin permiso" }, { status: 403 }),
    );
    expect((await patch({ contractId: ct, saldoInicial: 1 })).status).toBe(403);
  });
});
