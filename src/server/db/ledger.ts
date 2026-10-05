import { db } from "./index";
import { ledgerDays, payments, contracts } from "./schema";
import { eq, asc } from "drizzle-orm";

export type LedgerRow = {
  diaSeq: number;
  fecha: string;
  cuotaDia: number;
  exento: boolean;
  motivo: string | null;
  totalPagado: number;
  deudaAcumulada: number;
  estado: "Al día" | "Pendiente";
  pagos: { id: string; monto: number; metodo: string; nota: string | null }[];
};

/**
 * Deuda(n) = max(0, Deuda(n-1) + cuotaDia - SUM(pagos dia))
 * Arranca en contracts.saldoInicial. Orden cronológico por fecha.
 * Invariante: todo pago tiene su día (la API lo garantiza).
 */
export async function getLedger(contractId: string): Promise<LedgerRow[]> {
  const ct = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId));
  const saldoInicial = ct[0]?.saldoInicial ?? 0;

  const days = await db
    .select()
    .from(ledgerDays)
    .where(eq(ledgerDays.contractId, contractId))
    .orderBy(asc(ledgerDays.fecha), asc(ledgerDays.diaSeq));

  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.contractId, contractId));

  const byFecha = new Map<string, typeof pays>();
  for (const p of pays) {
    const arr = byFecha.get(p.fecha) ?? [];
    arr.push(p);
    byFecha.set(p.fecha, arr);
  }

  let deuda = saldoInicial;
  return days.map((d) => {
    const lista = byFecha.get(d.fecha) ?? [];
    const total = lista.reduce((a: number, p: typeof pays[number]) => a + p.monto, 0);
    deuda = Math.max(0, deuda + d.cuotaDia - total);
    return {
      diaSeq: d.diaSeq,
      fecha: d.fecha,
      cuotaDia: d.cuotaDia,
      exento: (d.exento ?? 0) === 1,
      motivo: d.motivo,
      totalPagado: total,
      deudaAcumulada: deuda,
      estado: deuda <= 0 ? "Al día" : "Pendiente",
      pagos: lista.map((p) => ({
        id: p.id,
        monto: p.monto,
        metodo: p.metodo,
        nota: p.nota,
      })),
    };
  });
}

export function summarize(ledger: LedgerRow[], saldoInicial = 0) {
  const last = ledger[ledger.length - 1];
  const pendientes = ledger.filter((r) => r.estado === "Pendiente").length;
  const recaudoMes = (prefix: string) =>
    ledger
      .filter((r) => r.fecha.startsWith(prefix))
      .reduce((a, r) => a + r.totalPagado, 0);
  return {
    deudaTotal: last?.deudaAcumulada ?? saldoInicial,
    diasPendientes: pendientes,
    diasTotal: ledger.length,
    recaudoMes,
    ultimo: last,
  };
}
