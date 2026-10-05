"use client";
import { useEffect, useState } from "react";
import { fmtCOP, todayISO } from "@/lib/utils";

type Veh = { id: string; placa: string; alias: string | null; cuotaBase: number };
type Ct = { id: string; vehicleId: string; clientId: string; fechaInicio: string };
type Cli = { id: string; nombre: string; telefono: string };
type Row = {
  diaSeq: number; fecha: string; cuotaDia: number; totalPagado: number;
  deudaAcumulada: number; estado: string;
  pagos: { id: string; monto: number; metodo: string; nota: string | null }[];
};

export default function DashboardClient() {
  const [vehs, setVehs] = useState<Veh[]>([]);
  const [cts, setCts] = useState<Ct[]>([]);
  const [clis, setClis] = useState<Cli[]>([]);
  const [contractId, setContractId] = useState("");
  const [ledger, setLedger] = useState<Row[]>([]);
  const [fecha, setFecha] = useState(todayISO());
  const [cuota, setCuota] = useState("17000");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");

  async function loadBase() {
    const r = await fetch("/api/vehicles");
    const j = await r.json();
    setVehs(j.vehicles ?? []);
    setCts(j.contracts ?? []);
    setClis(j.clients ?? []);
    if (!contractId && j.contracts?.[0]) setContractId(j.contracts[0].id);
  }
  async function loadLedger(id: string) {
    if (!id) return;
    const r = await fetch(`/api/ledger?contractId=${id}`);
    const j = await r.json();
    setLedger((j.ledger ?? []).slice().reverse()); // 90 arriba como Notion
  }
  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadLedger(contractId); }, [contractId]);
  // Precarga cuota del día con la base de la moto seleccionada
  useEffect(() => {
    const ct = cts.find((c) => c.id === contractId);
    const veh = vehs.find((v) => v.id === ct?.vehicleId);
    if (veh) setCuota(String(veh.cuotaBase));
  }, [contractId, vehs, cts]);

  const last = [...ledger].reverse().pop();
  const deuda = last?.deudaAcumulada ?? 0;
  const pend = ledger.filter((x) => x.estado === "Pendiente").length;
  const mes = todayISO().slice(0, 7);
  const recaudo = ledger.filter((x) => x.fecha.startsWith(mes)).reduce((a, x) => a + x.totalPagado, 0);

  async function genDia() {
    const r = await fetch("/api/ledger", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, fecha, cuotaDia: Number(cuota) }),
    });
    if (!r.ok) alert((await r.json()).error);
    else { setFecha(todayISO()); loadLedger(contractId); }
  }
  async function addPago(fechaPago: string) {
    if (!monto) return alert("monto requerido");
    const r = await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, fecha: fechaPago, monto: Number(monto), metodo }),
    });
    if (!r.ok) alert((await r.json()).error);
    else { setMonto(""); loadLedger(contractId); }
  }

  const ct = cts.find((c) => c.id === contractId);
  const veh = vehs.find((v) => v.id === ct?.vehicleId);
  const cli = clis.find((c) => c.id === ct?.clientId);

  if (cts.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4 w-full">
        <h1 className="text-2xl font-bold">Pagos — CuotaMoto</h1>
        <div className="card p-6 text-center space-y-3">
          <p className="font-bold">Aún no hay contratos</p>
          <p className="text-sm text-slate-300">Paso 1: crea una moto · Paso 2: crea el cliente · Paso 3: crea el contrato.</p>
          <a className="btn btn-primary inline-block" href="/admin">Ir a /admin</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4 w-full">
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagos — CuotaMoto</h1>
          <p className="text-sm text-slate-300">{veh ? `${veh.placa} · ${cli?.nombre ?? ""} · base ${fmtCOP(veh.cuotaBase)}` : "sin contratos"}</p>
        </div>
        <nav className="flex gap-2 text-sm">
          <a className="btn btn-ghost" href="/pendientes">Pendientes</a>
          <a className="btn btn-ghost" href="/admin">Admin</a>
          <a className="btn btn-ghost" href="/api/auth/signout">Salir</a>
        </nav>
      </header>

      <div className="flex gap-2 flex-wrap">
        {cts.map((c) => {
          const v = vehs.find((x) => x.id === c.vehicleId);
          return (
            <button key={c.id} onClick={() => setContractId(c.id)}
              className={`btn ${c.id === contractId ? "btn-primary" : "btn-ghost"}`}>
              {v?.placa ?? c.id.slice(0, 6)}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-xs text-slate-400">DEUDA TOTAL</p><p className="font-mono-num text-xl font-bold">{fmtCOP(deuda)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-400">DÍAS PENDIENTES</p><p className="font-mono-num text-xl font-bold">{pend}/{ledger.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-400">RECAUDO {mes}</p><p className="font-mono-num text-xl font-bold">{fmtCOP(recaudo)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-400">CONTRATO</p><p className="text-sm">{ct?.fechaInicio ?? "-"}</p></div>
      </div>

      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <div><label className="text-xs">Fecha nuevo día</label><input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div><label className="text-xs">Cuota día (variable)</label><input className="input font-mono-num" value={cuota} onChange={(e) => setCuota(e.target.value)} /></div>
        <button className="btn btn-accent" onClick={genDia}>+ Generar día</button>
        <div className="flex gap-2 items-end ml-auto">
          <div><label className="text-xs">Monto pago</label><input className="input font-mono-num" placeholder="93000" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
          <div><label className="text-xs">Método</label>
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option>efectivo</option><option>nequi</option><option>bancolombia</option><option>daviplata</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {ledger.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="font-bold">Contrato sin días</p>
            <p className="text-sm text-slate-300">Genera el día 1 abajo con la cuota de la moto y luego registra pagos.</p>
          </div>
        ) : (
        <table className="dense w-full min-w-[760px]">
          <thead><tr><th>Día</th><th>Fecha</th><th>Cuota</th><th>Pago (SUM, N pagos)</th><th>Deuda</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>
            {ledger.map((r) => (
              <tr key={r.diaSeq}>
                <td className="font-mono-num font-bold">{r.diaSeq}</td>
                <td>{r.fecha}</td>
                <td className="font-mono-num">{fmtCOP(r.cuotaDia)}</td>
                <td className="font-mono-num">
                  {fmtCOP(r.totalPagado)}
                  {r.pagos.length > 1 && <span className="text-xs text-sky-300"> ({r.pagos.length} pagos)</span>}
                  {r.pagos.length > 0 && <div className="text-xs text-slate-400">{r.pagos.map((p) => `${fmtCOP(p.monto)} ${p.metodo}`).join(" · ")}</div>}
                </td>
                <td className="font-mono-num font-bold">{fmtCOP(r.deudaAcumulada)}</td>
                <td><span className={`badge ${r.estado === "Al día" ? "badge-ok" : "badge-pend"}`}>{r.estado === "Al día" ? "✓ Al día" : "● Pendiente"}</span></td>
                <td><button className="btn btn-ghost text-xs" onClick={() => addPago(r.fecha)}>+ pago aquí</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      <p className="text-xs text-slate-400">Deuda(n) = Deuda(n-1) + cuotaDía − SUM(pagos día). La cuota puede variar por moto y por día.</p>
    </div>
  );
}
