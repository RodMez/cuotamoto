"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { hoyBogota } from "@/lib/utils";
import type { AdminSnapshot, Cli, ContractHealth, Ct, LedgerRow, Veh } from "./types";

async function fetchJSON(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? `Error ${r.status}`);
  return j;
}

export function useAdminData() {
  const [vehs, setVehs] = useState<Veh[]>([]);
  const [clis, setClis] = useState<Cli[]>([]);
  const [cts, setCts] = useState<Ct[]>([]);
  const [healthByContract, setHealthByContract] = useState<Record<string, ContractHealth>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [serieCache, setSerieCache] = useState<{ fecha: string; deuda: number; recaudo: number }[]>([]);

  const refresh = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const j = await fetchJSON("/api/vehicles");
      const v: Veh[] = j.vehicles ?? [];
      const c: Ct[] = j.contracts ?? [];
      const cl: Cli[] = j.clients ?? [];
      setVehs(v);
      setCts(c);
      setClis(cl);

      const activos = c.filter((x) => x.activo === 1);
      // Ledgers en paralelo, tolerante a fallos individuales
      const results = await Promise.all(
        activos.map(async (ct) => {
          try {
            const lj = await fetchJSON(`/api/ledger?contractId=${ct.id}`);
            const ledger: LedgerRow[] = lj.ledger ?? [];
            const last = ledger[ledger.length - 1];
            const mes = hoyBogota().slice(0, 7);
            const recaudoMes = ledger
              .filter((x) => x.fecha.startsWith(mes))
              .reduce((a, x) => a + x.totalPagado, 0);
            const diasPend = ledger.filter((x) => x.estado === "Pendiente").length;
            const h: ContractHealth = {
              contractId: ct.id,
              deuda: last?.deudaAcumulada ?? ct.saldoInicial ?? 0,
              diasPend,
              diasTotal: ledger.length,
              recaudoMes,
              alDia: diasPend === 0,
            };
            return { id: ct.id, health: h, ledger };
          } catch {
            return {
              id: ct.id,
              health: {
                contractId: ct.id,
                deuda: ct.saldoInicial ?? 0,
                diasPend: 0,
                diasTotal: 0,
                recaudoMes: 0,
                alDia: true,
              } as ContractHealth,
              ledger: [] as LedgerRow[],
            };
          }
        }),
      );
      const map: Record<string, ContractHealth> = {};
      for (const r of results) {
        map[r.id] = r.health;
      }
      setHealthByContract(map);

      // Serie 14 días: recaudo diario sumado por fecha
      const fechas = Array.from(
        new Set(results.flatMap((r) => r.ledger.map((l) => l.fecha))),
      ).sort();
      const last14 = fechas.slice(-14);
      const serie = last14.map((fecha) => {
        let recaudo = 0;
        for (const r of results) {
          const row = r.ledger.find((l) => l.fecha === fecha);
          if (row) recaudo += row.totalPagado;
        }
        return { fecha, deuda: 0, recaudo };
      });
      setSerieCache(serie);
      setLastUpdated(new Date().toLocaleTimeString("es-CO", { hour12: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(false);
  }, [refresh]);

  const snapshot: AdminSnapshot = useMemo(() => {
    const contratosActivos = cts.filter((c) => c.activo === 1);
    const deudaTotal = contratosActivos.reduce((a, c) => a + (healthByContract[c.id]?.deuda ?? c.saldoInicial ?? 0), 0);
    const diasPendTotal = contratosActivos.reduce((a, c) => a + (healthByContract[c.id]?.diasPend ?? 0), 0);
    const recaudoMesTotal = contratosActivos.reduce((a, c) => a + (healthByContract[c.id]?.recaudoMes ?? 0), 0);
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
      serieDeuda14d: serieCache,
    };
  }, [vehs, clis, cts, healthByContract, serieCache]);

  return { snapshot, loading, refreshing, error, lastUpdated, refresh };
}
