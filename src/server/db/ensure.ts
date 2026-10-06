import { db } from "./index";
import { ledgerDays, contracts, vehicles, omisiones } from "./schema";
import { eq, and } from "drizzle-orm";
import { uid, nowISO, esDomingo, esFechaValida } from "@/lib/utils";

/** Tipo del `tx` de db.transaction (better-sqlite3: síncrono). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const addDays = (fecha: string, n: number) => {
  const d = new Date(fecha + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * SÍNCRONA a propósito: drizzle+better-sqlite3 serializa las transacciones
 * en el proceso, así dos peticiones concurrentes no chocan con el índice único.
 * El callback de db.transaction no puede ser async ni usar await.
 */
function ensureDaysTx(
  tx: Tx,
  contractId: string,
  hastaFecha: string,
  cuotaDefault?: number,
): number {
  if (!esFechaValida(hastaFecha)) throw new Error("fecha inválida (YYYY-MM-DD)");
  const ct = tx.select().from(contracts).where(eq(contracts.id, contractId)).get();
  if (!ct) throw new Error("contrato no existe");
  if (hastaFecha < ct.fechaInicio) return 0;

  const days = tx.select().from(ledgerDays).where(eq(ledgerDays.contractId, contractId)).all();
  const existentes = new Set(days.map((d) => d.fecha));
  const maxSeq = days.reduce((m, d) => Math.max(m, d.diaSeq), 0);
  const maxFecha = days.reduce((m, d) => (d.fecha > m ? d.fecha : m), "");
  const desde = maxFecha && maxFecha >= ct.fechaInicio ? addDays(maxFecha, 1) : ct.fechaInicio;

  const omis = tx.select().from(omisiones).where(eq(omisiones.contractId, contractId)).all();
  const omisMap = new Map(omis.map((o) => [o.fecha, o.motivo]));

  let base = cuotaDefault;
  if (base === undefined) {
    const ordenados = [...days].sort((a, b) =>
      a.fecha === b.fecha ? a.diaSeq - b.diaSeq : a.fecha < b.fecha ? -1 : 1,
    );
    base = ordenados.length ? ordenados[ordenados.length - 1].cuotaDia : undefined;
  }
  if (base === undefined) {
    const veh = tx.select().from(vehicles).where(eq(vehicles.id, ct.vehicleId)).get();
    base = veh?.cuotaBase ?? 17000;
  }

  let seq = maxSeq;
  let creados = 0;
  for (let f = desde; f <= hastaFecha; f = addDays(f, 1)) {
    if (existentes.has(f)) continue;
    const motivoOmi = omisMap.get(f) ?? null;
    const domingoOmi = ct.omitirDomingos === 1 && esDomingo(f);
    const exento = motivoOmi !== null || domingoOmi;
    seq += 1;
    tx.insert(ledgerDays)
      .values({
        id: uid(),
        contractId,
        diaSeq: seq,
        fecha: f,
        cuotaDia: exento ? 0 : base,
        exento: exento ? 1 : 0,
        motivo: motivoOmi ?? (domingoOmi ? "Domingo" : null),
        createdAt: nowISO(),
      })
      .onConflictDoNothing()
      .run();
    existentes.add(f);
    creados += 1;
  }
  return creados;
}

/**
 * Crea los días faltantes hasta `hastaFecha`. Idempotente.
 * Domingos con omitirDomingos y fechas en `omisiones` → exentos (cuota 0).
 */
export function ensureDays(contractId: string, hastaFecha: string, cuotaDefault?: number): number {
  return db.transaction((tx) => ensureDaysTx(tx, contractId, hastaFecha, cuotaDefault));
}

/** Generación + inserto extra dentro de UNA transacción del llamador. */
export function ensureDaysInTx(tx: Tx, contractId: string, hastaFecha: string): number {
  return ensureDaysTx(tx, contractId, hastaFecha);
}

/** ¿Existe el día (contractId, fecha)? */
export function diaExiste(contractId: string, fecha: string) {
  const rows = db
    .select({ id: ledgerDays.id })
    .from(ledgerDays)
    .where(and(eq(ledgerDays.contractId, contractId), eq(ledgerDays.fecha, fecha)))
    .all();
  return rows.length > 0;
}
