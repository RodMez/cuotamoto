import { describe, expect, it } from "vitest";
import {
  barWidthPct,
  bulletPct,
  donutGeom,
  DONUT_R,
  fmtCOPShort,
  points,
  topMax,
} from "@/lib/chart-math";

describe("points", () => {
  it("vacío no dibuja nada", () => {
    expect(points([], 120, 36)).toBe("");
  });

  it("un solo valor: step 0, todo en x=pad", () => {
    expect(points([5], 120, 36)).toBe("6.0,6.0");
  });

  it("escala min/max al área con pad", () => {
    expect(points([0, 10], 120, 36)).toBe("6.0,30.0 114.0,6.0");
  });
});

describe("donutGeom", () => {
  it("calcula total, porcentaje y offset del arco", () => {
    const g = donutGeom(3, 1);
    expect(g.total).toBe(4);
    expect(g.pPend).toBe(25);
    expect(g.C).toBeCloseTo(2 * Math.PI * DONUT_R);
    expect(g.off).toBeCloseTo(g.C * 0.75);
  });

  it("cero contratos no divide por cero", () => {
    const g = donutGeom(0, 0);
    expect(g.total).toBe(1);
    expect(g.pPend).toBe(0);
    expect(g.off).toBe(g.C);
  });
});

describe("topMax / barWidthPct", () => {
  it("máximo con piso 1 y ancho mínimo 4%", () => {
    expect(topMax([30, 70])).toBe(70);
    expect(topMax([])).toBe(1);
    expect(barWidthPct(70, 70)).toBe(100);
    expect(barWidthPct(1, 1000)).toBe(4);
    expect(barWidthPct(0, 5)).toBe(4);
  });
});

describe("bulletPct", () => {
  it("topado a 100, 0 sin meta", () => {
    expect(bulletPct(50, 100)).toBe(50);
    expect(bulletPct(150, 100)).toBe(100);
    expect(bulletPct(10, 0)).toBe(0);
  });
});

describe("fmtCOPShort", () => {
  it("abrevia millones y miles", () => {
    expect(fmtCOPShort(1_200_000)).toBe("1.2M");
    expect(fmtCOPShort(-2_500_000)).toBe("-2.5M");
    expect(fmtCOPShort(17000)).toBe("17k");
    expect(fmtCOPShort(999)).toBe("999");
  });
});
