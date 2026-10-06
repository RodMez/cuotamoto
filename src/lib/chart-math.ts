/** Matemática de Charts/Kpi (réplica exacta, sin JSX). */

export function points(values: number[], w: number, h: number, pad = 6): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export const DONUT_R = 34;

export function donutGeom(ok: number, pend: number) {
  const total = ok + pend || 1;
  const pPend = Math.round((pend / total) * 100);
  const C = 2 * Math.PI * DONUT_R;
  const off = C * (1 - pend / total);
  return { total, pPend, C, off };
}

/** Máximo de TopBars (piso 1 para no dividir por cero). */
export function topMax(values: number[]): number {
  return Math.max(...values, 1);
}

/** Ancho de barra con mínimo visible del 4%. */
export function barWidthPct(value: number, max: number): number {
  return Math.max(4, Math.round((value / max) * 100));
}

/** Porcentaje del Bullet, topado a 100 (0 si no hay meta). */
export function bulletPct(value: number, target: number): number {
  return target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
}

export function fmtCOPShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}
