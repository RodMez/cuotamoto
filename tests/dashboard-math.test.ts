import { describe, expect, it } from "vitest";
import {
  cuotaPrecargada,
  ledgerRecientePrimero,
  panelKpis,
  type PanelRow,
} from "@/lib/dashboard-math";

function fila(partial: Partial<PanelRow> & { fecha: string }): PanelRow {
  return {
    deudaAcumulada: 17000,
    credito: 0,
    estado: "Pendiente",
    totalPagado: 0,
    ...partial,
  };
}

describe("ledgerRecientePrimero", () => {
  it("invierte sin mutar el original", () => {
    const orig = [fila({ fecha: "2026-10-01" }), fila({ fecha: "2026-10-02" })];
    const inv = ledgerRecientePrimero(orig);
    expect(inv.map((r) => r.fecha)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(orig.map((r) => r.fecha)).toEqual(["2026-10-01", "2026-10-02"]);
  });
});

describe("panelKpis", () => {
  it("vacío usa saldoInicial (0 por defecto)", () => {
    expect(panelKpis([], { hoy: "2026-10-15" })).toMatchObject({
      deuda: 0,
      credito: 0,
      pend: 0,
      mes: "2026-10",
      recaudo: 0,
      total: 0,
    });
    expect(panelKpis([], { saldoInicial: 5000 }).deuda).toBe(5000);
  });

  it("deuda/crédito salen del día MÁS RECIENTE (primero de la lista invertida)", () => {
    // Lista YA invertida (reciente primero): [día3, día2, día1]
    const reciente = [
      fila({ fecha: "2026-10-03", deudaAcumulada: 3000, estado: "Pendiente", totalPagado: 0 }),
      fila({ fecha: "2026-10-02", deudaAcumulada: 2000, estado: "Pendiente", totalPagado: 5000 }),
      fila({ fecha: "2026-10-01", deudaAcumulada: 1000, credito: 0, estado: "Al día", totalPagado: 17000 }),
    ];
    const k = panelKpis(reciente, { hoy: "2026-10-15" });
    expect(k.deuda).toBe(3000); // el día más reciente, no el más viejo
    expect(k.pend).toBe(2);
    expect(k.mes).toBe("2026-10");
    expect(k.recaudo).toBe(0 + 5000 + 17000);
    expect(k.total).toBe(3);
  });

  it("crédito a favor también viene del día más reciente", () => {
    const reciente = [
      fila({ fecha: "2026-10-02", deudaAcumulada: 0, credito: 33000, estado: "Al día" }),
      fila({ fecha: "2026-10-01", deudaAcumulada: 17000, estado: "Pendiente" }),
    ];
    expect(panelKpis(reciente, { hoy: "2026-10-02" })).toMatchObject({
      deuda: 0,
      credito: 33000,
    });
  });

  it("recaudo filtra por mes del hoy dado", () => {
    const reciente = [
      fila({ fecha: "2026-10-01", totalPagado: 10000 }),
      fila({ fecha: "2026-09-30", totalPagado: 17000 }),
    ];
    expect(panelKpis(reciente, { hoy: "2026-10-05" }).recaudo).toBe(10000);
  });
});

describe("cuotaPrecargada", () => {
  it("respeta lo escrito o cae a la base (17000 por defecto)", () => {
    expect(cuotaPrecargada(null, 25000)).toBe("25000");
    expect(cuotaPrecargada(null, undefined)).toBe("17000");
    expect(cuotaPrecargada("20000", 25000)).toBe("20000");
  });
});
