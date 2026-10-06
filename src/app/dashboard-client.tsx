"use client";
import { Component, Suspense, use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { fmtCOP, hoyBogota } from "@/lib/utils";
import { cuotaPrecargada, ledgerRecientePrimero, panelKpis } from "@/lib/dashboard-math";

type Veh = { id: string; placa: string; alias: string | null; cuotaBase: number };
type Ct = { id: string; vehicleId: string; clientId: string; fechaInicio: string; saldoInicial: number; omitirDomingos: number };
type Cli = { id: string; nombre: string; telefono: string };
type Pago = { id: string; monto: number; metodo: string; nota: string | null };
type Row = {
  diaSeq: number; fecha: string; cuotaDia: number; exento: boolean; motivo: string | null;
  totalPagado: number; deudaAcumulada: number; credito: number; creditoUsado: number;
  estado: string; pagos: Pago[];
};
type Base = { vehicles: Veh[]; contracts: Ct[]; clients: Cli[] };

async function fetchJSON(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? `Error ${r.status}`);
  return j;
}

// Cache fuera del render: cuando React descarta un render suspendido,
// el useMemo se pierde con él y cada reintento crearía un fetch nuevo
// (loop infinito). El Map sobrevive y la promesa resuelta se reutiliza.
const promiseCache = new Map<string, Promise<unknown>>();

function useJSON<T>(url: string): T {
  let p = promiseCache.get(url);
  if (!p) {
    p = fetchJSON(url);
    promiseCache.set(url, p);
    p.catch(() => {
      if (promiseCache.get(url) === p) promiseCache.delete(url);
    });
  }
  return use(p as Promise<T>);
}

/** Invalida una URL cacheada (llamar antes de remontar tras una mutación). */
function evictJSON(url: string) {
  promiseCache.delete(url);
}

class PanelError extends Component<
  { children: ReactNode; onRetry?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="card p-6 text-center space-y-2">
          <p className="font-bold">No se pudo cargar</p>
          <p className="text-sm text-red-300">{this.state.error.message}</p>
          <button
            className="btn btn-ghost"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry?.();
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PanelCargando({ texto }: { texto: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm text-slate-300">{texto}</p>
    </div>
  );
}

function LedgerPanel({
  contractId,
  veh,
  ct,
  onMutated,
}: {
  contractId: string;
  veh?: Veh;
  ct?: Ct;
  onMutated: () => void;
}) {
  const data = useJSON<{ ledger: Row[] }>(`/api/ledger?contractId=${contractId}`);
  const ledgerURL = `/api/ledger?contractId=${contractId}`;
  const ledger = useMemo(() => ledgerRecientePrimero(data.ledger ?? []), [data]);
  const [fecha, setFecha] = useState(hoyBogota());
  const [cuota, setCuota] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [nota, setNota] = useState("");
  const hoy = hoyBogota();
  const cuotaVal = cuotaPrecargada(cuota, veh?.cuotaBase);

  const { deuda, credito, pend, mes, recaudo } = panelKpis(ledger, {
    saldoInicial: ct?.saldoInicial,
    hoy,
  });

  async function genDias() {
    try {
      await fetchJSON("/api/ledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, fecha, cuotaDia: Number(cuotaVal) }),
      });
      setFecha(hoyBogota());
      evictJSON(ledgerURL);
      onMutated();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function registrarPago() {
    if (!monto) {
      alert("monto requerido");
      return;
    }
    try {
      await fetchJSON("/api/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, monto: Number(monto), metodo, nota: nota || undefined }),
      });
      setMonto("");
      setNota("");
      setModalAbierto(false);
      evictJSON(ledgerURL);
      onMutated();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function borrarPago(id: string) {
    if (!confirm("¿Borrar este pago? (solo admin)")) return;
    try {
      await fetchJSON(`/api/payments?id=${id}`, { method: "DELETE" });
      evictJSON(ledgerURL);
      onMutated();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-xs text-slate-400">DEUDA TOTAL</p><p className="font-mono-num text-xl font-bold">{fmtCOP(deuda)}</p>{credito > 0 && <p className="text-xs text-emerald-300">a favor: {fmtCOP(credito)}</p>}</div>
        <div className="card p-4"><p className="text-xs text-slate-400">DÍAS PENDIENTES</p><p className="font-mono-num text-xl font-bold">{pend}/{ledger.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-400">RECAUDO {mes}</p><p className="font-mono-num text-xl font-bold">{fmtCOP(recaudo)}</p></div>
        <button className="btn btn-accent text-lg font-bold" onClick={() => { setMonto(""); setModalAbierto(true); }}>+ Abonar hoy</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <div><label className="text-xs">Generar días hasta</label><input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div><label className="text-xs">Cuota (si crea nuevo)</label><input className="input font-mono-num" value={cuotaVal} onChange={(e) => setCuota(e.target.value)} /></div>
        <button className="btn btn-accent" onClick={genDias}>+ Generar días</button>
        <p className="text-xs text-slate-400 w-full">Crea los faltantes hasta la fecha (respeta domingos y omisiones). Al registrar un pago el día se crea solo si falta.</p>
      </div>

      <div className="card overflow-x-auto">
        {ledger.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="font-bold">Contrato sin días</p>
            <p className="text-sm text-slate-300">Genera los días arriba o registra el primer pago.</p>
          </div>
        ) : (
        <table className="dense w-full min-w-[760px]">
          <thead><tr><th>Día</th><th>Fecha</th><th>Cuota</th><th>Pagos del día</th><th>Deuda</th><th>Estado</th></tr></thead>
          <tbody>
            {ledger.map((r) => (
              <tr key={r.fecha} className={r.exento ? "opacity-70" : ""}>
                <td className="font-mono-num font-bold">{r.diaSeq}</td>
                <td>{r.fecha}{r.exento && <div className="text-xs text-slate-400">Exento{r.motivo ? ` — ${r.motivo}` : ""}</div>}</td>
                <td className="font-mono-num">{r.exento ? "0" : fmtCOP(r.cuotaDia)}</td>
                <td className="font-mono-num">
                  {fmtCOP(r.totalPagado)}
                  {r.pagos.length > 1 && <span className="text-xs text-sky-300"> ({r.pagos.length})</span>}
                  {r.pagos.length > 0 && (
                    <div className="text-xs text-slate-400 space-y-1 mt-1">
                      {r.pagos.map((p) => (
                        <div key={p.id} className="flex gap-2 items-center">
                          <span>{fmtCOP(p.monto)} {p.metodo}{p.nota ? ` · ${p.nota}` : ""}</span>
                          <button className="text-red-300 hover:text-red-200" title="Borrar pago (admin)" onClick={() => borrarPago(p.id)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="font-mono-num font-bold">{fmtCOP(r.deudaAcumulada)}</td>
                <td><span className={`badge ${r.estado === "Al día" ? "badge-ok" : "badge-pend"}`}>{r.estado === "Al día" ? "✓ Al día" : "● Pendiente"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      <p className="text-xs text-slate-400">Saldo corrido desde el saldo inicial: deuda = lo que falta, crédito = saldo a favor. Todo pago se aplica al día de hoy.</p>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" onClick={() => setModalAbierto(false)}>
          <div className="card p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Abonar hoy — {hoy}</h2>
            <p className="text-xs text-slate-400">Se aplica al día de hoy ({hoy}).</p>
            <div><label className="text-xs">Monto COP</label><input className="input font-mono-num" placeholder="17000" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
            <div><label className="text-xs">Método</label>
              <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                <option>efectivo</option><option>nequi</option><option>bancolombia</option><option>daviplata</option>
              </select>
            </div>
            <div><label className="text-xs">Nota (opcional)</label><input className="input" placeholder="..." value={nota} onChange={(e) => setNota(e.target.value)} /></div>
            <div className="flex gap-2">
              <button className="btn btn-accent flex-1" onClick={registrarPago}>Guardar pago</button>
              <button className="btn btn-ghost" onClick={() => setModalAbierto(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardClient() {
  const base = useJSON<Base>("/api/vehicles");
  const vehs = base.vehicles ?? [];
  const cts = base.contracts ?? [];
  const clis = base.clients ?? [];
  const [contractId, setContractId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const ct = cts.find((c) => c.id === contractId) ?? cts[0];
  const activeId = ct?.id ?? null;
  const veh = vehs.find((v) => v.id === ct?.vehicleId);
  const cli = clis.find((c) => c.id === ct?.clientId);

  if (cts.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4 w-full">
        <h1 className="text-2xl font-bold">Pagos — CuotaMoto</h1>
        <div className="card p-6 text-center space-y-3">
          <p className="font-bold">Aún no hay contratos</p>
          <p className="text-sm text-slate-300">Paso 1: crea una moto · Paso 2: crea el cliente · Paso 3: crea el contrato.</p>
          <Link className="btn btn-primary inline-block" href="/admin">Ir a /admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4 w-full">
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagos — CuotaMoto</h1>
          <p className="text-sm text-slate-300">
            {veh ? `${veh.placa} · ${cli?.nombre ?? ""} · base ${fmtCOP(veh.cuotaBase)}` : "sin contratos"}
            {(ct?.saldoInicial ?? 0) > 0 && ` · saldo inicial ${fmtCOP(ct!.saldoInicial)}`}
            {ct ? ` · desde ${ct.fechaInicio}` : ""}
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link className="btn btn-ghost" href="/pendientes">Pendientes</Link>
          <Link className="btn btn-ghost" href="/admin">Admin</Link>
          <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: "/login" })}>Salir</button>
        </nav>
      </header>

      <div className="flex gap-2 flex-wrap">
        {cts.map((c) => {
          const v = vehs.find((x) => x.id === c.vehicleId);
          return (
            <button key={c.id} onClick={() => setContractId(c.id)}
              className={`btn ${c.id === activeId ? "btn-primary" : "btn-ghost"}`}>
              {v?.placa ?? c.id.slice(0, 6)}
            </button>
          );
        })}
      </div>

      {activeId && (
        <PanelError
          key={`err-${activeId}`}
          onRetry={() => setRefreshKey((k) => k + 1)}
        >
          <Suspense fallback={<PanelCargando texto="Cargando días…" />}>
            <LedgerPanel
              key={`${activeId}:${refreshKey}`}
              contractId={activeId}
              veh={veh}
              ct={ct}
              onMutated={() => setRefreshKey((k) => k + 1)}
            />
          </Suspense>
        </PanelError>
      )}
    </div>
  );
}

export function DashboardRoot() {
  const [k, setK] = useState(0);
  return (
    <PanelError onRetry={() => setK((x) => x + 1)}>
      <Suspense fallback={<PanelCargando texto="Cargando pagos…" />}>
        <DashboardClient key={k} />
      </Suspense>
    </PanelError>
  );
}
