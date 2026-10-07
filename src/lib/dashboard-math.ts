import { hoyBogota } from "./utils";

/** Fila mínima que necesita el panel (la API devuelve más campos). */
export type PanelRow = {
  fecha: string;
  deudaAcumulada: number;
  credito: number;
  estado: string;
  totalPagado: number;
};

/** La tabla muestra lo reciente arriba: invierte sin mutar. */
export function ledgerRecientePrimero<T>(ledger: T[]): T[] {
  return [...ledger].reverse();
}

/**
 * KPIs del panel. Recibe el ledger YA invertido (reciente primero).
 * deuda/crédito salen del día MÁS RECIENTE ([0]); pend/recaudo recorren todo.
 */
export function panelKpis(
  ledgerReciente: PanelRow[],
  opts: { saldoInicial?: number; hoy?: string } = {},
) {
  const hoy = opts.hoy ?? hoyBogota();
  const last = ledgerReciente[0];
  const deuda = last?.deudaAcumulada ?? opts.saldoInicial ?? 0;
  const credito = last?.credito ?? 0;
  const pend = ledgerReciente.filter((x) => x.estado === "Pendiente").length;
  const mes = hoy.slice(0, 7);
  const recaudo = ledgerReciente
    .filter((x) => x.fecha.startsWith(mes))
    .reduce((a, x) => a + x.totalPagado, 0);
  return { deuda, credito, pend, mes, recaudo, total: ledgerReciente.length };
}

/** Cuota precargada del generador: lo escrito por el usuario o la base. */
export function cuotaPrecargada(cuota: string | null, cuotaBase?: number): string {
  return cuota ?? String(cuotaBase ?? 17000);
}
