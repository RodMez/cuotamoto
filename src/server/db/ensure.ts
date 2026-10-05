import { db } from "./index";
import { ledgerDays, contracts, vehicles, omisiones } from "./schema";
import { eq, and } from "drizzle-orm";
import { uid, nowISO, esDomingo, esFechaValida } from "@/lib/utils";

const addDays = (fecha: string, n: number) => {
  const d = new Date(fecha + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Crea los días faltantes de un contrato desde el último existente
 * (o fechaInicio) hasta `hastaFecha`. Idempotente.
 * Domingos con omitirDomingos y fechas en `omisiones` se crean exentos (cuota 0).
 * Devuelve cuántos creó. Lanza si el contrato no existe o la fecha es inválida.
 */
export async function ensureDays(
  contractId: string,
  hastaFecha: string,
  cuotaDefault?: number,
): Promise<number> {
  if (!esFechaValida(hastaFecha)) throw new Error("fecha inválida (YYYY-MM-DD)");
  const cts = await db.select().from(contracts).where(eq(contracts.id, contractId));
  const ct = cts[0];
  if (!ct) throw new Error("contrato no existe");
  if (hastaFecha < ct.fechaInicio) return 0;

  const days = await db.select().from(ledgerDays).where(eq(ledgerDays.contractId, contractId));
  const existentes = new Set(days.map((d) => d.fecha));
  const maxSeq = days.reduce((m, d) => Math.max(m, d.diaSeq), 0);
  const maxFecha = days.reduce((m, d) => (d.fecha > m ? d.fecha : m), "");
  let desde = maxFecha && maxFecha >= ct.fechaInicio ? addDays(maxFecha, 1) : ct.fechaInicio;

  const omis = await db
    .select()
    .from(omisiones)
    .where(eq(omisiones.contractId, contractId));
  const omisMap = new Map(omis.map((o) => [o.fecha, o.motivo]));

  let base = cuotaDefault;
  if (base === undefined) {
    const ordenados = [...days].sort((a, b) =>
      a.fecha === b.fecha ? a.diaSeq - b.diaSeq : a.fecha < b.fecha ? -1 : 1,
    );
    base = ordenados.length ? ordenados[ordenados.length - 1].cuotaDia : undefined;
  }
  if (base === undefined) {
    const veh = await db.select().from(vehicles).where(eq(vehicles.id, ct.vehicleId));
    base = veh[0]?.cuotaBase ?? 17000;
  }

  let seq = maxSeq;
  let creados = 0;
  for (let f = desde; f <= hastaFecha; f = addDays(f, 1)) {
    if (existentes.has(f)) continue;
    const motivoOmi = omisMap.get(f) ?? null;
    const domingoOmi = ct.omitirDomingos === 1 && esDomingo(f);
    const exento = motivoOmi !== null || domingoOmi;
    seq += 1;
    await db.insert(ledgerDays).values({
      id: uid(),
      contractId,
      diaSeq: seq,
      fecha: f,
      cuotaDia: exento ? 0 : base,
      exento: exento ? 1 : 0,
      motivo: motivoOmi ?? (domingoOmi ? "Domingo" : null),
      createdAt: nowISO(),
    });
    creados += 1;
  }
  return creados;
}

/** ¿Existe el día (contractId, fecha)? */
export async function diaExiste(contractId: string, fecha: string) {
  const rows = await db
    .select({ id: ledgerDays.id })
    .from(ledgerDays)
    .where(and(eq(ledgerDays.contractId, contractId), eq(ledgerDays.fecha, fecha)));
  return rows.length > 0;
}
