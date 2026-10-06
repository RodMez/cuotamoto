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
  /** Saldo corrido (puede ser negativo = crédito). Nunca se almacena: se deriva. */
  saldo: number;
  deudaAcumulada: number;
  /** Saldo a favor disponible después de este día. */
  credito: number;
  /** Cuánto del crédito previo cubrió la cuota de hoy. */
  creditoUsado: number;
  estado: "Al día" | "Pendiente";
  pagos: { id: string; monto: number; metodo: string; nota: string | null }[];
};

/**
 * Saldo corrido derivado (sin columna de crédito: no se desincroniza
 * al editar/borrar historial, todo se recalcula solo):
 *   saldo += cuotaDia - SUM(pagos dia), arranca en saldoInicial
 *   deuda = max(0, saldo), credito = max(0, -saldo)
 * Los exentos (cuota 0) conservan el crédito.
 * Invariante: todo pago tiene su día (la API lo garantiza).
 */
export async function getLedger(contractId: string): Promise<LedgerRow[]> {
  const ct = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId));

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

  let saldo = ct[0]?.saldoInicial ?? 0;
  return days.map((d) => {
    const lista = byFecha.get(d.fecha) ?? [];
    const total = lista.reduce((a: number, p: typeof pays[number]) => a + p.monto, 0);
    const creditoAntes = Math.max(0, -saldo);
    saldo = saldo + d.cuotaDia - total;
    return {
      diaSeq: d.diaSeq,
      fecha: d.fecha,
      cuotaDia: d.cuotaDia,
      exento: (d.exento ?? 0) === 1,
      motivo: d.motivo,
      totalPagado: total,
      saldo,
      deudaAcumulada: Math.max(0, saldo),
      credito: Math.max(0, -saldo),
      creditoUsado: Math.min(creditoAntes, d.cuotaDia),
      estado: saldo <= 0 ? ("Al día" as const) : ("Pendiente" as const),
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
    creditoTotal: last?.credito ?? 0,
    diasPendientes: pendientes,
    diasTotal: ledger.length,
    recaudoMes,
    ultimo: last,
  };
}
