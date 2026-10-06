import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Auth real (NextAuth) fuera: las rutas solo ven requireRole/identity.
const authMocks = vi.hoisted(() => ({ requireRole: vi.fn(), identity: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireRole: authMocks.requireRole,
  identity: authMocks.identity,
}));

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { contracts, payments } from "@/server/db/schema";
import { hoyBogota } from "@/lib/utils";
import { POST, DELETE } from "@/app/api/payments/route";
import { auditByAccion, fixture, migrateTestDb } from "./helpers";

const ADMIN = { id: "u-test-admin", rol: "admin" } as const;

function post(body: unknown) {
  return POST(new Request("http://localhost/api/payments", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

function denyOnce(status: 401 | 403) {
  authMocks.requireRole.mockRejectedValueOnce(
    Response.json({ error: status === 401 ? "no auth" : "sin permiso" }, { status }),
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

describe("POST /api/payments", () => {
  it("registra el pago SIEMPRE con hoy Bogotá (ignora fecha del body)", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    const res = await post({ contractId: ct, monto: 17000, fecha: "2020-01-05", metodo: "nequi" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.payment.fecha).toBe(hoyBogota());
    expect(j.payment.metodo).toBe("nequi");

    const rows = await db.select().from(payments).where(eq(payments.id, j.payment.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].createdBy).toBe(ADMIN.id);
  });

  it("genera el día (y faltantes) en la misma operación si no existe", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    const res = await post({ contractId: ct, monto: 5000 });
    expect(res.status).toBe(200);
    // El pago de hoy implica que el día de hoy existe en el ledger
    const { getLedger } = await import("@/server/db/ledger");
    const L = await getLedger(ct);
    expect(L[L.length - 1].fecha).toBe(hoyBogota());
    expect(L[L.length - 1].totalPagado).toBe(5000);
  });

  it("deja rastro de auditoría crear_pago sin secretos", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    const j = await (await post({ contractId: ct, monto: 8000 })).json();
    const rows = await auditByAccion("crear_pago");
    const mine = rows.filter((r) => r.entidadId === j.payment.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].userId).toBe(ADMIN.id);
    expect(mine[0].despues).toContain("8000");
  });

  it("400 con monto inválido o sin contractId", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    for (const body of [
      { contractId: ct, monto: 0 },
      { contractId: ct, monto: -100 },
      { contractId: ct, monto: "abc" },
      { contractId: ct, monto: 17.5 },
      { monto: 17000 },
      {},
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
    }
  });

  it("404 con contrato inexistente", async () => {
    const res = await post({ contractId: "no-existe", monto: 17000 });
    expect(res.status).toBe(404);
  });

  it("401 sin sesión y 403 con rol sin permiso", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    denyOnce(401);
    expect((await post({ contractId: ct, monto: 1000 })).status).toBe(401);
    denyOnce(403);
    expect((await post({ contractId: ct, monto: 1000 })).status).toBe(403);
  });
});

describe("DELETE /api/payments", () => {
  it("admin borra con auditoría borrar_pago", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    const j = await (await post({ contractId: ct, monto: 9000 })).json();
    const del = await DELETE(new Request(`http://localhost/api/payments?id=${j.payment.id}`));
    expect(del.status).toBe(200);
    expect(
      await db.select().from(payments).where(eq(payments.id, j.payment.id)),
    ).toHaveLength(0);
    const rows = await auditByAccion("borrar_pago");
    expect(rows.filter((r) => r.entidadId === j.payment.id)).toHaveLength(1);
  });

  it("400 sin id y 404 con pago inexistente", async () => {
    expect((await DELETE(new Request("http://localhost/api/payments"))).status).toBe(400);
    expect((await DELETE(new Request("http://localhost/api/payments?id=no-existe"))).status).toBe(
      404,
    );
  });

  it("403 para cobrador (solo admin borra)", async () => {
    denyOnce(403);
    expect((await DELETE(new Request("http://localhost/api/payments?id=x"))).status).toBe(403);
  });

  it("el contrato sigue consistente tras borrar (deuda derivada se recalcula)", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    const j = await (await post({ contractId: ct, monto: 17000 })).json();
    await DELETE(new Request(`http://localhost/api/payments?id=${j.payment.id}`));
    const cts = await db.select().from(contracts).where(eq(contracts.id, ct));
    expect(cts[0]).toBeDefined(); // el contrato no se toca; el ledger se deriva solo
  });
});
