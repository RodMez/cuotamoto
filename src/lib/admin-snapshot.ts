import type {
  AdminSnapshot,
  ContractHealth,
  Ct,
  LedgerRow,
} from "@/components/admin/types";

/**
 * Salud por contrato (réplica exacta de useAdminData).
 * `mes` es el prefijo YYYY-MM del mes en curso (el hook pasa hoyBogota()).
 */
export function contractHealth(
  ct: Pick<Ct, "id" | "saldoInicial">,
  ledger: LedgerRow[],
  mes: string,
): ContractHealth {
  const last = ledger[ledger.length - 1];
  const recaudoMes = ledger
    .filter((x) => x.fecha.startsWith(mes))
    .reduce((a, x) => a + x.totalPagado, 0);
  const diasPend = ledger.filter((x) => x.estado === "Pendiente").length;
  return {
    contractId: ct.id,
    deuda: last?.deudaAcumulada ?? ct.saldoInicial ?? 0,
    diasPend,
    diasTotal: ledger.length,
    recaudoMes,
    alDia: diasPend === 0,
  };
}

/** Fallback cuando el ledger de un contrato falla (tolerante a fallos). */
export function healthFallback(ct: Pick<Ct, "id" | "saldoInicial">): ContractHealth {
  return {
    contractId: ct.id,
    deuda: ct.saldoInicial ?? 0,
    diasPend: 0,
    diasTotal: 0,
    recaudoMes: 0,
    alDia: true,
  };
}

/** Serie últimos 14 días: recaudo diario sumado por fecha (deuda siempre 0). */
export function buildSerie(
  ledgers: Pick<LedgerRow, "fecha" | "totalPagado">[][],
): { fecha: string; deuda: number; recaudo: number }[] {
  const fechas = Array.from(new Set(ledgers.flatMap((l) => l.map((x) => x.fecha)))).sort();
  return fechas.slice(-14).map((fecha) => {
    let recaudo = 0;
    for (const ledger of ledgers) {
      const row = ledger.find((l) => l.fecha === fecha);
      if (row) recaudo += row.totalPagado;
    }
    return { fecha, deuda: 0, recaudo };
  });
}

export function buildSnapshot(args: {
  vehs: AdminSnapshot["vehs"];
  clis: AdminSnapshot["clis"];
  cts: AdminSnapshot["cts"];
  healthByContract: Record<string, ContractHealth>;
  serie: { fecha: string; deuda: number; recaudo: number }[];
}): AdminSnapshot {
  const { vehs, clis, cts, healthByContract, serie } = args;
  const contratosActivos = cts.filter((c) => c.activo === 1);
  const deudaTotal = contratosActivos.reduce(
    (a, c) => a + (healthByContract[c.id]?.deuda ?? c.saldoInicial ?? 0),
    0,
  );
  const diasPendTotal = contratosActivos.reduce(
    (a, c) => a + (healthByContract[c.id]?.diasPend ?? 0),
    0,
  );
  const recaudoMesTotal = contratosActivos.reduce(
    (a, c) => a + (healthByContract[c.id]?.recaudoMes ?? 0),
    0,
  );
  const ocupadasIds = new Set(contratosActivos.map((c) => c.vehicleId));
  const motosOcupadas = vehs.filter((v) => ocupadasIds.has(v.id));
  const motosLibres = vehs.filter((v) => !ocupadasIds.has(v.id));
  const topDeudores = contratosActivos
    .map((c) => {
      const v = vehs.find((x) => x.id === c.vehicleId);
      const cli = clis.find((x) => x.id === c.clientId);
      const h = healthByContract[c.id];
      return {
        contractId: c.id,
        placa: v?.placa ?? "?",
        cliente: cli?.nombre ?? "?",
        deuda: h?.deuda ?? c.saldoInicial ?? 0,
        diasPend: h?.diasPend ?? 0,
      };
    })
    .filter((x) => x.deuda > 0)
    .sort((a, b) => b.deuda - a.deuda)
    .slice(0, 8);
  return {
    vehs,
    clis,
    cts,
    healthByContract,
    deudaTotal,
    diasPendTotal,
    recaudoMesTotal,
    motosLibres,
    motosOcupadas,
    contratosActivos,
    topDeudores,
    serieDeuda14d: serie,
  };
}
