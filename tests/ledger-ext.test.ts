import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { omisiones } from "@/server/db/schema";
import { getLedger, summarize } from "@/server/db/ledger";
import { diaExiste, ensureDays } from "@/server/db/ensure";
import { nowISO, uid } from "@/lib/utils";
import { fixture, migrateTestDb, pay } from "./helpers";

// Bordes de getLedger/ensureDays no cubiertos por ledger.test.ts.
// Fixtures con ids únicos: sin deletes globales (no interfiere con otros archivos).

beforeAll(() => {
  migrateTestDb();
});

describe("getLedger: bordes de pago", () => {
  it("pago exacto deja saldo en cero y estado Al día", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-02");
    await pay(ct, "2026-11-02", 17000);
    const L = await getLedger(ct);
    expect(L).toHaveLength(1);
    expect(L[0].totalPagado).toBe(17000);
    expect(L[0].saldo).toBe(0);
    expect(L[0].deudaAcumulada).toBe(0);
    expect(L[0].credito).toBe(0);
    expect(L[0].creditoUsado).toBe(0);
    expect(L[0].estado).toBe("Al día");
  });

  it("múltiples pagos el mismo día se suman", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-02");
    await pay(ct, "2026-11-02", 10000);
    await pay(ct, "2026-11-02", 7000);
    const L = await getLedger(ct);
    expect(L[0].totalPagado).toBe(17000);
    expect(L[0].estado).toBe("Al día");
    expect(L[0].pagos).toHaveLength(2);
  });

  it("saldoInicial negativo actúa como crédito inicial", async () => {
    const ct = await fixture({ inicio: "2026-11-02", saldoInicial: -10000 });
    await ensureDays(ct, "2026-11-02");
    const L = await getLedger(ct);
    // saldo = -10000 + 17000 = 7000
    expect(L[0].saldo).toBe(7000);
    expect(L[0].deudaAcumulada).toBe(7000);
    expect(L[0].credito).toBe(0);
    // el crédito previo cubrió 10k de la cuota (tope: min(creditoAntes, cuotaDia))
    expect(L[0].creditoUsado).toBe(10000);
    expect(L[0].estado).toBe("Pendiente");
  });

  it("pago en día exento no se pierde: baja la deuda y conserva exento", async () => {
    // 2026-10-03 sábado, 2026-10-04 domingo exento
    const ct = await fixture({ inicio: "2026-10-03", omitirDomingos: true });
    await ensureDays(ct, "2026-10-04");
    await pay(ct, "2026-10-04", 5000);
    const L = await getLedger(ct);
    const dom = L.find((r) => r.fecha === "2026-10-04")!;
    expect(dom.exento).toBe(true);
    expect(dom.cuotaDia).toBe(0);
    expect(dom.totalPagado).toBe(5000);
    // sábado 17k + domingo (0 − 5k) = 12k
    expect(dom.deudaAcumulada).toBe(12000);
    expect(dom.creditoUsado).toBe(0); // sin crédito previo ni cuota que cubrir
  });

  it("varios días sin pagos acumulan deuda día a día", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-04");
    const L = await getLedger(ct);
    expect(L.map((r) => r.deudaAcumulada)).toEqual([17000, 34000, 51000]);
    const sum = summarize(L);
    expect(sum.diasTotal).toBe(3);
    expect(sum.diasPendientes).toBe(3);
    expect(sum.deudaTotal).toBe(51000);
  });
});

describe("ensureDays: bordes", () => {
  it("hastaFecha anterior al inicio no crea nada", async () => {
    const ct = await fixture({ inicio: "2026-11-10" });
    expect(await ensureDays(ct, "2026-11-01")).toBe(0);
    expect(await getLedger(ct)).toEqual([]);
  });

  it("rechaza fecha inválida y contrato inexistente", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    expect(() => ensureDays(ct, "2026-02-31")).toThrow();
    expect(() => ensureDays(ct, "no-fecha")).toThrow();
    expect(() => ensureDays("no-existe", "2026-11-02")).toThrow();
  });

  it("usa la cuotaBase del vehículo cuando no hay días previos", async () => {
    const ct = await fixture({ inicio: "2026-11-02", cuotaBase: 25000 });
    await ensureDays(ct, "2026-11-02");
    const L = await getLedger(ct);
    expect(L[0].cuotaDia).toBe(25000);
    expect(L[0].deudaAcumulada).toBe(25000);
  });

  it("cuotaDefault explícita rige y se hereda a días siguientes", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-02", 20000);
    await ensureDays(ct, "2026-11-03");
    const L = await getLedger(ct);
    expect(L.map((r) => r.cuotaDia)).toEqual([20000, 20000]);
  });

  it("omisión creada DESPUÉS del día no lo exime retroactivamente", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    await ensureDays(ct, "2026-11-03");
    await db.insert(omisiones).values({
      id: uid(),
      contractId: ct,
      fecha: "2026-11-03",
      motivo: "Taller tardío",
      createdAt: nowISO(),
    });
    // El día ya existe: ensureDays no lo toca (solo crea faltantes).
    expect(await ensureDays(ct, "2026-11-03")).toBe(0);
    const L = await getLedger(ct);
    const dia = L.find((r) => r.fecha === "2026-11-03")!;
    expect(dia.exento).toBe(false);
    expect(dia.cuotaDia).toBe(17000);
  });

  it("diaExiste refleja la generación", async () => {
    const ct = await fixture({ inicio: "2026-11-02" });
    expect(diaExiste(ct, "2026-11-02")).toBe(false);
    await ensureDays(ct, "2026-11-02");
    expect(diaExiste(ct, "2026-11-02")).toBe(true);
    expect(diaExiste(ct, "2026-11-03")).toBe(false);
  });
});
