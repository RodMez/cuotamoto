import { describe, expect, it } from "vitest";
import { contarDiasPendientes, type FilaDiasPendientes } from "@/lib/pendientes";

const fila = (cuotaDia: number, deudaAcumulada: number): FilaDiasPendientes => ({
  cuotaDia,
  deudaAcumulada,
});

describe("contarDiasPendientes", () => {
  it("sin días o sin deuda devuelve 0", () => {
    expect(contarDiasPendientes([])).toBe(0);
    expect(contarDiasPendientes([fila(17000, 0)])).toBe(0);
  });

  it("crédito a favor (deuda final 0) no cuenta días históricos", () => {
    const ledger = [fila(17000, 17000), fila(17000, 0)];
    expect(contarDiasPendientes(ledger)).toBe(0);
  });

  it("cuenta cuotas desde el final hasta cubrir la deuda", () => {
    const ledger = [fila(17000, 17000), fila(17000, 34000), fila(17000, 51000)];
    expect(contarDiasPendientes(ledger)).toBe(3);
  });

  it("un abono parcial reduce los días", () => {
    // Debe 3.000 sobre cuotas de 17.000: solo 1 día.
    expect(contarDiasPendientes([fila(17000, 17000), fila(17000, 3000)])).toBe(1);
  });

  it("ignora los días exentos al final", () => {
    const ledger = [fila(17000, 17000), fila(0, 17000), fila(0, 17000)];
    expect(contarDiasPendientes(ledger)).toBe(1);
  });

  it("usa la cuota real de cada día (cuotas variables)", () => {
    const ledger = [fila(10000, 10000), fila(20000, 30000), fila(20000, 50000)];
    expect(contarDiasPendientes(ledger)).toBe(3); // 20k + 20k + 10k
  });

  it("si la deuda supera las cuotas generadas, topa al total de días", () => {
    const ledger = [fila(17000, 100000), fila(17000, 117000)];
    expect(contarDiasPendientes(ledger)).toBe(2);
  });

  it("no muta el arreglo recibido", () => {
    const ledger = [fila(17000, 17000), fila(17000, 34000)];
    contarDiasPendientes(ledger);
    expect(ledger.map((f) => f.deudaAcumulada)).toEqual([17000, 34000]);
  });
});
