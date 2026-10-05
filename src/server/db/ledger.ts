import { db } from "./index";
import { ledgerDays, payments } from "./schema";
import { eq, asc } from "drizzle-orm";

export type LedgerRow = {
  diaSeq: number;
  fecha: string;
  cuotaDia: number;
  totalPagado: number;
  deudaAcumulada: number;
  estado: "Al día" | "Pendiente";
  pagos: { id: string; monto: number; metodo: string; nota: string | null }[];
};

/**
 * Deuda(n) = Deuda(n-1) + cuotaDia - SUM(pagos dia)
 */
export async function getLedger(contractId: string): Promise<LedgerRow[]> {
  const days = await db
    .select()
    .from(ledgerDays)
    .where(eq(ledgerDays.contractId, contractId))
    .orderBy(asc(ledgerDays.diaSeq));

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

  let deuda = 0;
  return days.map((d) => {
    const lista = byFecha.get(d.fecha) ?? [];
    const total = lista.reduce((a, p) => a + p.monto, 0);
    deuda = deuda + d.cuotaDia - total;
    return {
      diaSeq: d.diaSeq,
      fecha: d.fecha,
      cuotaDia: d.cuotaDia,
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

export function summarize(ledger: LedgerRow[]) {
  const last = ledger[ledger.length - 1];
  const pendientes = ledger.filter((r) => r.estado === "Pendiente").length;
  const recaudoMes = (prefix: string) =>
    ledger
      .filter((r) => r.fecha.startsWith(prefix))
      .reduce((a, r) => a + r.totalPagado, 0);
  return {
    deudaTotal: last?.deudaAcumulada ?? 0,
    diasPendientes: pendientes,
    diasTotal: ledger.length,
    recaudoMes,
    ultimo: last,
  };
}
