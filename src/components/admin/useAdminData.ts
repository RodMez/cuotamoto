"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { hoyBogota } from "@/lib/utils";
import { buildSerie, buildSnapshot, contractHealth, healthFallback } from "@/lib/admin-snapshot";
import type { AdminSnapshot, Cli, ContractHealth, Ct, LedgerRow, Usuario, Veh } from "./types";

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
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
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
      try {
        const uj = await fetchJSON("/api/admin/users");
        setUsuarios(uj.users ?? []);
      } catch {
        setUsuarios([]);
      }

      const activos = c.filter((x) => x.activo === 1);
      // Ledgers en paralelo, tolerante a fallos individuales
      const results = await Promise.all(
        activos.map(async (ct) => {
          try {
            const lj = await fetchJSON(`/api/ledger?contractId=${ct.id}`);
            const ledger: LedgerRow[] = lj.ledger ?? [];
            const h = contractHealth(ct, ledger, hoyBogota().slice(0, 7));
            return { id: ct.id, health: h, ledger };
          } catch {
            return {
              id: ct.id,
              health: healthFallback(ct),
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
      const serie = buildSerie(results.map((r) => r.ledger));
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
    return buildSnapshot({ vehs, clis, cts, healthByContract, serie: serieCache });
  }, [vehs, clis, cts, healthByContract, serieCache]);

  return { snapshot, usuarios, loading, refreshing, error, lastUpdated, refresh };
}
