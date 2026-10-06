import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireRole: vi.fn(), identity: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireRole: authMocks.requireRole,
  identity: authMocks.identity,
}));

import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { ledgerDays } from "@/server/db/schema";
import { getLedger } from "@/server/db/ledger";
import { ensureDays } from "@/server/db/ensure";
import { hoyBogota } from "@/lib/utils";
import { GET, POST, PATCH, DELETE } from "@/app/api/ledger/route";
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
const COBRADOR = { id: "u-test-cobrador", rol: "cobrador" } as const;

const manana = (() => {
  const d = new Date(hoyBogota() + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();

function post(body: unknown) {
  return POST(new Request("http://localhost/api/ledger", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

function patch(body: unknown) {
  return PATCH(new Request("http://localhost/api/ledger", {
    method: "PATCH",
    body: JSON.stringify(body),
  }));
}

function get(contractId: string) {
  return GET(new Request(`http://localhost/api/ledger?contractId=${contractId}`));
}

function del(contractId: string, fecha: string) {
  return DELETE(
    new Request(`http://localhost/api/ledger?contractId=${contractId}&fecha=${fecha}`),
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

describe("GET /api/ledger", () => {
  it("401 sin sesión y 400 sin contractId", async () => {
    authMocks.identity.mockResolvedValueOnce(null);
    expect((await get("ct-x")).status).toBe(401);
    expect((await GET(new Request("http://localhost/api/ledger"))).status).toBe(400);
  });

  it("generación perezosa: devuelve días desde el inicio hasta hoy Bogotá", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    const j = await (await get(ct)).json();
    expect(j.ledger.length).toBeGreaterThan(30);
    expect(j.ledger[0].fecha).toBe("2026-09-01");
    expect(j.ledger[j.ledger.length - 1].fecha).toBe(hoyBogota());
  });

  it("conductor solo ve su contrato", async () => {
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

describe("POST /api/ledger", () => {
  it("genera faltantes hasta la fecha y audita generar_dias", async () => {
    const ct = await fixture({ inicio: "2026-09-15" });
    const j = await (await post({ contractId: ct, fecha: "2026-09-18" })).json();
    expect(j.ok).toBe(true);
    expect(j.creados).toBe(4);
    expect((await getLedger(ct)).map((r) => r.fecha)).toEqual([
      "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18",
    ]);
    const rows = await auditByAccion("generar_dias");
    expect(rows.filter((r) => r.entidadId === ct)).toHaveLength(1);
  });

  it("cuotaDia manual aplica al día normal pero respeta el exento", async () => {
    // 2026-10-03 sábado normal, 2026-10-04 domingo exento
    const ct = await fixture({ inicio: "2026-10-03", omitirDomingos: true });
    await post({ contractId: ct, fecha: "2026-10-03", cuotaDia: 20000 });
    await post({ contractId: ct, fecha: "2026-10-04", cuotaDia: 20000 });
    const L = await getLedger(ct);
    expect(L.find((r) => r.fecha === "2026-10-03")!.cuotaDia).toBe(20000);
    const dom = L.find((r) => r.fecha === "2026-10-04")!;
    expect(dom.exento).toBe(true);
    expect(dom.cuotaDia).toBe(0);
  });

  it("cobrador no genera a futuro; admin sí", async () => {
    const ct1 = await fixture({ inicio: "2026-09-01" });
    authMocks.requireRole.mockResolvedValueOnce(COBRADOR);
    expect((await post({ contractId: ct1, fecha: manana })).status).toBe(400);

    const ct2 = await fixture({ inicio: "2026-09-01" });
    expect((await post({ contractId: ct2, fecha: manana })).status).toBe(200);
    expect((await getLedger(ct2)).at(-1)!.fecha).toBe(manana);
  });

  it("400 con fecha/cuota inválidas o contrato inexistente", async () => {
    const ct = await fixture({ inicio: "2026-09-01" });
    expect((await post({})).status).toBe(400);
    expect((await post({ contractId: ct, fecha: "2026-02-31" })).status).toBe(400);
    expect((await post({ contractId: ct, fecha: "2026-09-05", cuotaDia: 0 })).status).toBe(400);
    expect((await post({ contractId: ct, fecha: "2026-09-05", cuotaDia: -3 })).status).toBe(400);
    expect((await post({ contractId: ct, fecha: "2026-09-05", cuotaDia: 17.5 })).status).toBe(400);
    expect((await post({ contractId: "ct-no", fecha: "2026-09-05" })).status).toBe(400);
  });
});

describe("PATCH /api/ledger", () => {
  it("edita cuotaDia y motivo", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-02");
    expect(
      (await patch({ contractId: ct, fecha: "2026-11-02", cuotaDia: 20000, motivo: "Ajuste" }))
        .status,
    ).toBe(200);
    const dia = (await getLedger(ct))[0];
    expect(dia.cuotaDia).toBe(20000);
    expect(dia.motivo).toBe("Ajuste");
  });

  it("mueve la fecha si no hay pagos; con pagos o duplicada lo bloquea", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-03");
    expect(
      (await patch({ contractId: ct, fecha: "2026-11-02", nuevaFecha: "2026-11-05" })).status,
    ).toBe(200);
    expect((await getLedger(ct)).map((r) => r.fecha)).toEqual(["2026-11-03", "2026-11-05"]);

    await pay(ct, "2026-11-03", 1000);
    expect(
      (await patch({ contractId: ct, fecha: "2026-11-03", nuevaFecha: "2026-11-06" })).status,
    ).toBe(400);
    expect(
      (await patch({ contractId: ct, fecha: "2026-11-05", nuevaFecha: "2026-11-03" })).status,
    ).toBe(400); // ya existe un día con esa fecha
  });

  it("400 con patch vacío o cuota inválida; 404 si el día no existe", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-02");
    expect((await patch({ contractId: ct, fecha: "2026-11-02" })).status).toBe(400);
    expect((await patch({ contractId: ct, fecha: "2026-11-02", cuotaDia: -1 })).status).toBe(400);
    expect((await patch({ contractId: ct, fecha: "2026-12-31", cuotaDia: 1 })).status).toBe(404);
  });

  it("solo admin", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "sin permiso" }, { status: 403 }),
    );
    expect((await patch({ contractId: ct, fecha: "2026-11-02", cuotaDia: 1 })).status).toBe(403);
  });
});

describe("DELETE /api/ledger", () => {
  it("borra el día sin pagos con auditoría", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-03");
    const dayId = (await db.select().from(ledgerDays).where(
      and(eq(ledgerDays.contractId, ct), eq(ledgerDays.fecha, "2026-11-03")),
    ))[0].id;
    expect((await del(ct, "2026-11-03")).status).toBe(200);
    expect((await getLedger(ct)).map((r) => r.fecha)).toEqual(["2026-11-02"]);
    const rows = await auditByAccion("borrar_dia");
    expect(rows.filter((r) => r.entidadId === dayId)).toHaveLength(1);
  });

  it("bloquea días con pagos, 404 si no existe, 400 sin params", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-02");
    await pay(ct, "2026-11-02", 1000);
    expect((await del(ct, "2026-11-02")).status).toBe(400);
    expect((await del(ct, "2026-12-31")).status).toBe(404);
    expect((await DELETE(new Request("http://localhost/api/ledger"))).status).toBe(400);
  });

  it("solo admin", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    authMocks.requireRole.mockRejectedValueOnce(
      Response.json({ error: "sin permiso" }, { status: 403 }),
    );
    expect((await del(ct, "2026-11-02")).status).toBe(403);
  });
});
