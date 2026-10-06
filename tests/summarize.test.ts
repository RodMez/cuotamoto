import { describe, expect, it } from "vitest";
import { summarize, type LedgerRow } from "@/server/db/ledger";

// summarize() es puro: se prueba sin DB construyendo filas a mano.

let seq = 0;
function fila(partial: Partial<LedgerRow> & { fecha: string }): LedgerRow {
  seq += 1;
  return {
    diaSeq: seq,
    cuotaDia: 17000,
    exento: false,
    motivo: null,
    totalPagado: 0,
    saldo: 17000,
    deudaAcumulada: 17000,
    credito: 0,
    creditoUsado: 0,
    estado: "Pendiente",
    pagos: [],
    ...partial,
  };
}

describe("summarize", () => {
  it("ledger vacío usa saldoInicial (0 por defecto)", () => {
    const vacio = summarize([]);
    expect(vacio.deudaTotal).toBe(0);
    expect(vacio.creditoTotal).toBe(0);
    expect(vacio.diasPendientes).toBe(0);
    expect(vacio.diasTotal).toBe(0);
    expect(vacio.ultimo).toBeUndefined();
    expect(vacio.recaudoMes("2026-10")).toBe(0);

    expect(summarize([], 5000).deudaTotal).toBe(5000);
  });

  it("cuenta pendientes y toma deuda/crédito de la última fila", () => {
    const L = [
      fila({ fecha: "2026-10-01", estado: "Al día", saldo: 0, deudaAcumulada: 0 }),
      fila({ fecha: "2026-10-02", estado: "Pendiente", saldo: 17000, deudaAcumulada: 17000 }),
      fila({ fecha: "2026-10-03", estado: "Pendiente", saldo: 34000, deudaAcumulada: 34000 }),
    ];
    const sum = summarize(L);
    expect(sum.diasTotal).toBe(3);
    expect(sum.diasPendientes).toBe(2);
    expect(sum.deudaTotal).toBe(34000);
    expect(sum.creditoTotal).toBe(0);
  });

  it("con crédito, deudaTotal es 0 y creditoTotal es el saldo a favor", () => {
    const L = [
      fila({
        fecha: "2026-10-01",
        estado: "Al día",
        totalPagado: 50000,
        saldo: -33000,
        deudaAcumulada: 0,
        credito: 33000,
      }),
    ];
    const sum = summarize(L);
    expect(sum.deudaTotal).toBe(0);
    expect(sum.creditoTotal).toBe(33000);
    expect(sum.diasPendientes).toBe(0);
  });

  it("recaudoMes filtra por prefijo y suma totalPagado", () => {
    const L = [
      fila({ fecha: "2026-09-30", totalPagado: 17000 }),
      fila({ fecha: "2026-10-01", totalPagado: 10000 }),
      fila({ fecha: "2026-10-02", totalPagado: 0 }),
    ];
    const sum = summarize(L);
    expect(sum.recaudoMes("2026-09")).toBe(17000);
    expect(sum.recaudoMes("2026-10")).toBe(10000);
    expect(sum.recaudoMes("2026")).toBe(27000);
    expect(sum.recaudoMes("2025")).toBe(0);
  });
});
