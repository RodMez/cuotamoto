"use client";
import { useEffect, useState } from "react";
import { fmtCOP, hoyBogota } from "@/lib/utils";

type Veh = { id: string; placa: string; alias: string | null; cuotaBase: number };
type Ct = { id: string; vehicleId: string; clientId: string; fechaInicio: string; saldoInicial: number; omitirDomingos: number };
type Cli = { id: string; nombre: string; telefono: string };
type Pago = { id: string; monto: number; metodo: string; nota: string | null };
type Row = {
  diaSeq: number; fecha: string; cuotaDia: number; exento: boolean; motivo: string | null;
  totalPagado: number; deudaAcumulada: number; credito: number; creditoUsado: number;
  estado: string; pagos: Pago[];
};

export default function DashboardClient() {
  const [vehs, setVehs] = useState<Veh[]>([]);
  const [cts, setCts] = useState<Ct[]>([]);
  const [clis, setClis] = useState<Cli[]>([]);
  const [contractId, setContractId] = useState("");
  const [ledger, setLedger] = useState<Row[]>([]);
  const [fecha, setFecha] = useState(hoyBogota());
  const [cuota, setCuota] = useState("17000");
  // Modal pago (siempre hoy Bogotá)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [nota, setNota] = useState("");
  const hoy = hoyBogota();

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
    setLedger((j.ledger ?? []).slice().reverse()); // más reciente arriba como Notion
  }
  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadLedger(contractId); }, [contractId]);
  // Precarga cuota con la base de la moto seleccionada
  useEffect(() => {
    const ct = cts.find((c) => c.id === contractId);
    const veh = vehs.find((v) => v.id === ct?.vehicleId);
    if (veh) setCuota(String(veh.cuotaBase));
  }, [contractId, vehs, cts]);

  const last = [...ledger].reverse().pop();
  const ct = cts.find((c) => c.id === contractId);
  const deuda = last?.deudaAcumulada ?? ct?.saldoInicial ?? 0;
  const credito = last?.credito ?? 0;
  const pend = ledger.filter((x) => x.estado === "Pendiente").length;
  const mes = hoyBogota().slice(0, 7);
  const recaudo = ledger.filter((x) => x.fecha.startsWith(mes)).reduce((a, x) => a + x.totalPagado, 0);

  async function genDias() {
    const r = await fetch("/api/ledger", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, fecha, cuotaDia: Number(cuota) }),
    });
    const j = await r.json();
    if (!r.ok) alert(j.error);
    else { setFecha(hoyBogota()); loadLedger(contractId); }
  }
  async function registrarPago() {
    if (!monto) return alert("monto requerido");
    const r = await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, monto: Number(monto), metodo, nota: nota || undefined }),
    });
    const j = await r.json();
    if (!r.ok) alert(j.error);
    else { setMonto(""); setNota(""); setModalAbierto(false); loadLedger(contractId); }
  }
  async function borrarPago(id: string) {
    if (!confirm("¿Borrar este pago? (solo admin)")) return;
    const r = await fetch(`/api/payments?id=${id}`, { method: "DELETE" });
    if (!r.ok) alert((await r.json()).error);
    else loadLedger(contractId);
  }

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
          <p className="text-sm text-slate-300">
            {veh ? `${veh.placa} · ${cli?.nombre ?? ""} · base ${fmtCOP(veh.cuotaBase)}` : "sin contratos"}
            {(ct?.saldoInicial ?? 0) > 0 && ` · saldo inicial ${fmtCOP(ct!.saldoInicial)}`}
            {ct ? ` · desde ${ct.fechaInicio}` : ""}
          </p>
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
        <div className="card p-4"><p className="text-xs text-slate-400">DEUDA TOTAL</p><p className="font-mono-num text-xl font-bold">{fmtCOP(deuda)}</p>{credito > 0 && <p className="text-xs text-emerald-300">a favor: {fmtCOP(credito)}</p>}</div>
        <div className="card p-4"><p className="text-xs text-slate-400">DÍAS PENDIENTES</p><p className="font-mono-num text-xl font-bold">{pend}/{ledger.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-400">RECAUDO {mes}</p><p className="font-mono-num text-xl font-bold">{fmtCOP(recaudo)}</p></div>
        <button className="btn btn-accent text-lg font-bold" onClick={() => { setMonto(""); setModalAbierto(true); }}>+ Abonar hoy</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <div><label className="text-xs">Generar días hasta</label><input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div><label className="text-xs">Cuota (si crea nuevo)</label><input className="input font-mono-num" value={cuota} onChange={(e) => setCuota(e.target.value)} /></div>
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
      <p className="text-xs text-slate-400">Deuda = max(0, anterior + cuota − pagos), arranca en saldo inicial. Todo pago se aplica al día de hoy.</p>

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
