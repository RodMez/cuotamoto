import { describe, expect, it } from "vitest";
import {
  esDomingo,
  esFechaValida,
  fmtCOP,
  hoyBogota,
  nowISO,
  todayISO,
  uid,
} from "@/lib/utils";

// Utilidades puras: sin DB, corren en milisegundos.

describe("esFechaValida", () => {
  it("acepta fechas calendario reales", () => {
    expect(esFechaValida("2026-02-28")).toBe(true);
    expect(esFechaValida("2024-02-29")).toBe(true); // bisiesto real
    expect(esFechaValida("2026-10-04")).toBe(true);
  });

  it("rechaza imposibles aunque Date.parse las acepte", () => {
    expect(esFechaValida("2026-02-29")).toBe(false); // 2026 no es bisiesto
    expect(esFechaValida("2026-02-31")).toBe(false);
    expect(esFechaValida("2026-13-01")).toBe(false);
    expect(esFechaValida("2026-00-10")).toBe(false);
  });

  it("rechaza formatos que no son YYYY-MM-DD", () => {
    expect(esFechaValida("no-fecha")).toBe(false);
    expect(esFechaValida("")).toBe(false);
    expect(esFechaValida("2026-1-1")).toBe(false);
    expect(esFechaValida("2026-10-04 ")).toBe(false);
    expect(esFechaValida("04-10-2026")).toBe(false);
  });
});

describe("esDomingo", () => {
  it("detecta domingos (2026-10-04 y 2026-09-27 fueron domingo)", () => {
    expect(esDomingo("2026-10-04")).toBe(true);
    expect(esDomingo("2026-09-27")).toBe(true);
  });

  it("rechaza sábado y lunes vecinos", () => {
    expect(esDomingo("2026-10-03")).toBe(false);
    expect(esDomingo("2026-10-05")).toBe(false);
  });
});

describe("fmtCOP", () => {
  it("formatea con separador de miles es-CO + sufijo", () => {
    expect(fmtCOP(17000)).toBe("17.000 COP");
    expect(fmtCOP(0)).toBe("0 COP");
    expect(fmtCOP(1200000)).toBe("1.200.000 COP");
  });
});

describe("fechas de hoy", () => {
  it("todayISO y hoyBogota devuelven YYYY-MM-DD válido", () => {
    for (const f of [todayISO(), hoyBogota()]) {
      expect(f).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(esFechaValida(f)).toBe(true);
    }
  });
});

describe("uid / nowISO", () => {
  it("uid genera ids únicos", () => {
    expect(uid()).not.toBe(uid());
  });

  it("nowISO es parseable como fecha", () => {
    expect(Number.isNaN(Date.parse(nowISO()))).toBe(false);
  });
});
