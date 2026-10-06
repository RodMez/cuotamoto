import { describe, expect, it } from "vitest";
import {
  buildSerie,
  buildSnapshot,
  contractHealth,
  healthFallback,
} from "@/lib/admin-snapshot";
import type { Ct, LedgerRow } from "@/components/admin/types";

let seq = 0;
function fila(partial: Partial<LedgerRow> & { fecha: string }): LedgerRow {
  seq += 1;
  return {
    diaSeq: seq,
    cuotaDia: 17000,
    exento: false,
    motivo: null,
    totalPagado: 0,
    deudaAcumulada: 17000,
    estado: "Pendiente",
    pagos: [],
    ...partial,
  };
}

const ct = (id: string, extra?: Partial<Ct>): Ct => ({
  id,
  vehicleId: "v-" + id,
  clientId: "c-" + id,
  fechaInicio: "2026-09-01",
  activo: 1,
  saldoInicial: 0,
  omitirDomingos: 0,
  ...extra,
});

describe("contractHealth", () => {
  it("deriva deuda/pendientes/recaudo del ledger", () => {
    const L = [
      fila({ fecha: "2026-09-30", estado: "Al día", deudaAcumulada: 0, totalPagado: 17000 }),
      fila({ fecha: "2026-10-01", estado: "Pendiente", deudaAcumulada: 17000, totalPagado: 5000 }),
      fila({ fecha: "2026-10-02", estado: "Pendiente", deudaAcumulada: 29000, totalPagado: 5000 }),
    ];
    expect(contractHealth(ct("a"), L, "2026-10")).toEqual({
      contractId: "a",
      deuda: 29000,
      diasPend: 2,
      diasTotal: 3,
      recaudoMes: 10000,
      alDia: false,
    });
  });

  it("vacío cae al saldoInicial y queda al día", () => {
    expect(contractHealth(ct("a", { saldoInicial: 4000 }), [], "2026-10")).toEqual({
      contractId: "a",
      deuda: 4000,
      diasPend: 0,
      diasTotal: 0,
      recaudoMes: 0,
      alDia: true,
    });
  });

  it("healthFallback es el mismo caso de fallo tolerado", () => {
    expect(healthFallback(ct("a", { saldoInicial: 7 }))).toEqual({
      contractId: "a",
      deuda: 7,
      diasPend: 0,
      diasTotal: 0,
      recaudoMes: 0,
      alDia: true,
    });
  });
});

describe("buildSerie", () => {
  it("suma recaudo por fecha y recorta a las últimas 14", () => {
    const fechas = Array.from({ length: 16 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const l1 = fechas.map((f) => fila({ fecha: f, totalPagado: 1000 }));
    const l2 = [fila({ fecha: "2026-09-16", totalPagado: 2000 })];
    const serie = buildSerie([l1, l2]);
    expect(serie).toHaveLength(14);
    expect(serie[0].fecha).toBe("2026-09-03"); // se cae 01 y 02
    expect(serie.at(-1)).toEqual({ fecha: "2026-09-16", deuda: 0, recaudo: 3000 });
  });

  it("vacío no rompe", () => {
    expect(buildSerie([])).toEqual([]);
  });
});

describe("buildSnapshot", () => {
  it("suma solo activos, separa libres/ocupadas y rankea top 8", () => {
    const vehs = [
      { id: "v1", placa: "AAA", alias: null, cuotaBase: 17000 },
      { id: "v2", placa: "BBB", alias: null, cuotaBase: 17000 },
      { id: "v3", placa: "CCC", alias: null, cuotaBase: 17000 },
    ];
    const clis = [{ id: "c1", nombre: "Ana", telefono: "300" }];
    const cts = [
      ct("a", { vehicleId: "v1", clientId: "c1" }),
      ct("b", { vehicleId: "v2", clientId: "c1", saldoInicial: 5000 }),
      ct("off", { vehicleId: "v3", clientId: "c1", activo: 0, saldoInicial: 99999 }),
    ];
    const health = {
      a: { contractId: "a", deuda: 34000, diasPend: 2, diasTotal: 2, recaudoMes: 0, alDia: false },
    };
    const snap = buildSnapshot({ vehs, clis, cts, healthByContract: health, serie: [] });
    // b sin health cae a su saldoInicial; off inactivo se ignora
    expect(snap.deudaTotal).toBe(34000 + 5000);
    expect(snap.diasPendTotal).toBe(2);
    expect(snap.motosOcupadas.map((v) => v.id)).toEqual(["v1", "v2"]);
    expect(snap.motosLibres.map((v) => v.id)).toEqual(["v3"]);
    expect(snap.contratosActivos.map((c) => c.id)).toEqual(["a", "b"]);
    expect(snap.topDeudores.map((t) => t.contractId)).toEqual(["a", "b"]);
    expect(snap.topDeudores[1]).toMatchObject({ placa: "BBB", cliente: "Ana", deuda: 5000 });
  });

  it("filtra al día y topa en 8", () => {
    const cts = Array.from({ length: 10 }, (_, i) => ct(`c${i}`));
    const health = Object.fromEntries(
      cts.map((c, i) => [
        c.id,
        { contractId: c.id, deuda: (i + 1) * 1000, diasPend: 1, diasTotal: 1, recaudoMes: 0, alDia: false },
      ]),
    );
    const snap = buildSnapshot({ vehs: [], clis: [], cts, healthByContract: health, serie: [] });
    expect(snap.topDeudores).toHaveLength(8);
    expect(snap.topDeudores[0].deuda).toBe(10000);
    expect(snap.topDeudores[0].placa).toBe("?");
  });
});
