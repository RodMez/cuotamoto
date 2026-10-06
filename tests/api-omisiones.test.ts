import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireRole: vi.fn(), identity: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireRole: authMocks.requireRole,
  identity: authMocks.identity,
}));

import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { omisiones } from "@/server/db/schema";
import { getLedger } from "@/server/db/ledger";
import { ensureDays } from "@/server/db/ensure";
import { GET, POST, DELETE } from "@/app/api/omisiones/route";
import {
  auditByAccion,
  fixture,
  migrateTestDb,
  mkClient,
  mkContract,
  mkUser,
  mkVehicle,
  pay,
} from "./helpers";

const ADMIN = { id: "u-test-admin", rol: "admin" } as const;

function post(body: unknown) {
  return POST(new Request("http://localhost/api/omisiones", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

function del(contractId: string, fecha: string) {
  return DELETE(
    new Request(`http://localhost/api/omisiones?contractId=${contractId}&fecha=${fecha}`),
  );
}

function get(contractId: string) {
  return GET(new Request(`http://localhost/api/omisiones?contractId=${contractId}`));
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

describe("POST /api/omisiones", () => {
  it("exime en el acto un día existente sin pagos", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-04");
    const res = await post({ contractId: ct, fecha: "2026-11-03", motivo: "Taller" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.aviso).toBeUndefined();

    const dia = (await getLedger(ct)).find((r) => r.fecha === "2026-11-03")!;
    expect(dia.exento).toBe(true);
    expect(dia.cuotaDia).toBe(0);
    expect(dia.motivo).toBe("Taller");
  });

  it("con pagos deja aviso y conserva la cuota del día", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-04");
    await pay(ct, "2026-11-03", 5000);
    const j = await (await post({ contractId: ct, fecha: "2026-11-03", motivo: "Taller" })).json();
    expect(j.ok).toBe(true);
    expect(j.aviso).toContain("pagos");

    const dia = (await getLedger(ct)).find((r) => r.fecha === "2026-11-03")!;
    expect(dia.exento).toBe(false);
    expect(dia.cuotaDia).toBe(17000);
  });

  it("motivo por defecto es 'Omitido' y duplicada responde 409", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    const j = await (await post({ contractId: ct, fecha: "2026-11-10" })).json();
    expect(j.ok).toBe(true);
    expect((await post({ contractId: ct, fecha: "2026-11-10" })).status).toBe(409);
  });

  it("400 con datos inválidos y 404 con contrato inexistente", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    expect((await post({})).status).toBe(400);
    expect((await post({ contractId: ct, fecha: "2026-02-31" })).status).toBe(400);
    expect((await post({ contractId: ct, fecha: "2026-10-01" })).status).toBe(400); // antes del inicio
    expect((await post({ contractId: "ct-no", fecha: "2026-11-03" })).status).toBe(404);
  });

  it("solo admin (403 para otros roles)", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "sin permiso" }, { status: 403 }),
    );
    expect((await post({ contractId: ct, fecha: "2026-11-03" })).status).toBe(403);
  });
});

describe("DELETE /api/omisiones", () => {
  it("borra el registro pero el día ya eximido conserva cuota 0", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-04");
    await post({ contractId: ct, fecha: "2026-11-03", motivo: "Taller" });
    const omiId = (await db.select().from(omisiones).where(
      and(eq(omisiones.contractId, ct), eq(omisiones.fecha, "2026-11-03")),
    ))[0].id;

    expect((await del(ct, "2026-11-03")).status).toBe(200);
    // La omisión ya no se lista…
    expect(((await (await get(ct)).json()).omisiones)).toHaveLength(0);
    // …pero el día generado sigue exento (la API no revierte días creados).
    const dia = (await getLedger(ct)).find((r) => r.fecha === "2026-11-03")!;
    expect(dia.exento).toBe(true);
    expect(dia.cuotaDia).toBe(0);

    const rows = await auditByAccion("borrar_omision");
    expect(rows.filter((r) => r.entidadId === omiId)).toHaveLength(1);
  });

  it("404 si no existe y 400 sin params", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    expect((await del(ct, "2026-11-03")).status).toBe(404);
    expect(
      (await DELETE(new Request("http://localhost/api/omisiones"))).status,
    ).toBe(400);
  });
});

describe("GET /api/omisiones", () => {
  it("401 sin sesión y 400 sin contractId", async () => {
    authMocks.identity.mockResolvedValueOnce(null);
    expect((await get("ct-x")).status).toBe(401);
    expect((await GET(new Request("http://localhost/api/omisiones"))).status).toBe(400);
  });

  it("conductor ve su contrato y recibe 403 en el ajeno", async () => {
    const u = await mkUser("conductor");
    const propio = await mkContract(await mkVehicle(), await mkClient({ userId: u }), {
      inicio: "2026-09-01",
    });
    const ajeno = await fixture({ inicio: "2026-09-01" });
    authMocks.identity.mockResolvedValue({ id: u, rol: "conductor" });

    expect((await get(propio)).status).toBe(200);
    expect((await get(ajeno)).status).toBe(403);
    expect((await get("ct-no-existe")).status).toBe(404);
  });
});
