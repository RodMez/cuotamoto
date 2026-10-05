"use client";
import { useEffect, useState } from "react";
import { todayISO } from "@/lib/utils";

type Veh = { id: string; placa: string; alias: string | null; cuotaBase: number };
type Cli = { id: string; nombre: string; telefono: string };
type Ct = { id: string; vehicleId: string; clientId: string; activo: number; saldoInicial: number; omitirDomingos: number };
type Omi = { id: string; contractId: string; fecha: string; motivo: string | null };

export default function AdminPage() {
  const [vehs, setVehs] = useState<Veh[]>([]);
  const [clis, setClis] = useState<Cli[]>([]);
  const [cts, setCts] = useState<Ct[]>([]);
  // moto
  const [placa, setPlaca] = useState("");
  const [cuota, setCuota] = useState("17000");
  const [alias, setAlias] = useState("");
  const [msgMoto, setMsgMoto] = useState("");
  // cliente
  const [nombre, setNombre] = useState("");
  const [telCli, setTelCli] = useState("");
  const [doc, setDoc] = useState("");
  const [msgCli, setMsgCli] = useState("");
  // contrato
  const [vehSel, setVehSel] = useState("");
  const [cliSel, setCliSel] = useState("");
  const [inicio, setInicio] = useState(todayISO());
  const [saldoIni, setSaldoIni] = useState("0");
  const [omitDom, setOmitDom] = useState(false);
  const [msgCt, setMsgCt] = useState("");
  // ajustes contrato
  const [ctSel, setCtSel] = useState("");
  const [saldoEdit, setSaldoEdit] = useState("");
  const [msgAjuste, setMsgAjuste] = useState("");
  // omisiones
  const [omiCt, setOmiCt] = useState("");
  const [omiFecha, setOmiFecha] = useState(todayISO());
  const [omiMotivo, setOmiMotivo] = useState("Taller");
  const [omis, setOmis] = useState<Omi[]>([]);
  const [msgOmi, setMsgOmi] = useState("");
  // usuario
  const [tel, setTel] = useState("");
  const [pass, setPass] = useState("");
  const [rol, setRol] = useState("conductor");
  const [cliLink, setCliLink] = useState("");
  const [msgUser, setMsgUser] = useState("");

  async function refresh() {
    const r = await fetch("/api/vehicles");
    const j = await r.json();
    setVehs(j.vehicles ?? []);
    setCts(j.contracts ?? []);
    setClis(j.clients ?? []);
  }
  useEffect(() => { refresh(); }, []);

  async function crearMoto() {
    setMsgMoto("");
    const r = await fetch("/api/vehicles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placa, cuotaBase: Number(cuota), alias }),
    });
    setMsgMoto(r.ok ? "moto creada" : (await r.json()).error);
    if (r.ok) { setPlaca(""); setAlias(""); refresh(); }
  }
  async function crearCliente() {
    setMsgCli("");
    const r = await fetch("/api/clients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono: telCli, documento: doc || undefined }),
    });
    setMsgCli(r.ok ? "cliente creado" : (await r.json()).error);
    if (r.ok) { setNombre(""); setTelCli(""); setDoc(""); refresh(); }
  }
  async function crearContrato() {
    setMsgCt("");
    const r = await fetch("/api/contracts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: vehSel, clientId: cliSel, fechaInicio: inicio,
        saldoInicial: Number(saldoIni) || 0, omitirDomingos: omitDom ? 1 : 0,
      }),
    });
    setMsgCt(r.ok ? "contrato creado (anteriores de la moto desactivados)" : (await r.json()).error);
    if (r.ok) refresh();
  }
  async function guardarAjuste() {
    setMsgAjuste("");
    const body: Record<string, unknown> = { contractId: ctSel };
    if (saldoEdit !== "") body.saldoInicial = Number(saldoEdit);
    const ct = cts.find((c) => c.id === ctSel);
    if (ct) body.omitirDomingos = ct.omitirDomingos === 1 ? 0 : 1;
    const r = await fetch("/api/contracts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsgAjuste(r.ok ? "ajuste guardado (deuda recalculada)" : (await r.json()).error);
    if (r.ok) { setSaldoEdit(""); refresh(); }
  }
  async function cargarOmis(id: string) {
    setOmiCt(id);
    if (!id) { setOmis([]); return; }
    const r = await fetch(`/api/omisiones?contractId=${id}`);
    setOmis((await r.json()).omisiones ?? []);
  }
  async function crearOmision() {
    setMsgOmi("");
    const r = await fetch("/api/omisiones", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: omiCt, fecha: omiFecha, motivo: omiMotivo }),
    });
    setMsgOmi(r.ok ? "día omitido (cuota 0)" : (await r.json()).error);
    if (r.ok) cargarOmis(omiCt);
  }
  async function borrarOmision(fecha: string) {
    const r = await fetch(`/api/omisiones?contractId=${omiCt}&fecha=${fecha}`, { method: "DELETE" });
    if (r.ok) cargarOmis(omiCt);
  }
  async function crearUser() {
    setMsgUser("");
    const r = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefono: tel, password: pass, rol, nombre: tel,
        clientId: rol === "conductor" && cliLink ? cliLink : undefined,
      }),
    });
    setMsgUser(r.ok ? "usuario creado" : (await r.json()).error);
    if (r.ok) { setTel(""); setPass(""); setCliLink(""); }
  }

  const motosLibres = vehs.filter((v) => !cts.some((c) => c.vehicleId === v.id && c.activo === 1));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4 w-full">
      <h1 className="text-2xl font-bold">Admin — flujo producción</h1>
      <a className="btn btn-ghost" href="/">← Volver</a>
      <p className="text-xs text-slate-400">Paso 1 moto → paso 2 cliente → paso 3 contrato. Sin demos.</p>

      <div className="card p-4 space-y-2">
        <h2 className="font-bold">1 · Nueva moto (cuota base variable)</h2>
        <input className="input" placeholder="Placa PMO-002" value={placa} onChange={(e) => setPlaca(e.target.value)} />
        <input className="input" placeholder="Alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
        <input className="input font-mono-num" placeholder="17000" value={cuota} onChange={(e) => setCuota(e.target.value)} />
        <button className="btn btn-primary" onClick={crearMoto}>Crear moto</button>
        {msgMoto && <p className="text-sm text-sky-200">{msgMoto}</p>}
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-bold">2 · Nuevo cliente (conductor real)</h2>
        <input className="input" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="input" placeholder="Teléfono 300..." value={telCli} onChange={(e) => setTelCli(e.target.value)} />
        <input className="input" placeholder="Documento (opcional)" value={doc} onChange={(e) => setDoc(e.target.value)} />
        <button className="btn btn-primary" onClick={crearCliente}>Crear cliente</button>
        {msgCli && <p className="text-sm text-sky-200">{msgCli}</p>}
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-bold">3 · Nuevo contrato (1 activo por moto)</h2>
        <select className="input" value={vehSel} onChange={(e) => setVehSel(e.target.value)}>
          <option value="">Moto libre… ({motosLibres.length})</option>
          {motosLibres.map((v) => <option key={v.id} value={v.id}>{v.placa} · base {v.cuotaBase}</option>)}
        </select>
        <select className="input" value={cliSel} onChange={(e) => setCliSel(e.target.value)}>
          <option value="">Cliente… ({clis.length})</option>
          {clis.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.telefono}</option>)}
        </select>
        <input className="input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <input className="input font-mono-num" placeholder="Saldo inicial (deuda vieja, ej 17000)" value={saldoIni} onChange={(e) => setSaldoIni(e.target.value)} />
        <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={omitDom} onChange={(e) => setOmitDom(e.target.checked)} /> Omitir domingos (cuota 0)</label>
        <button className="btn btn-accent" onClick={crearContrato}>Crear contrato</button>
        {msgCt && <p className="text-sm text-sky-200">{msgCt}</p>}
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-bold">Ajustes de contrato (solo admin)</h2>
        <select className="input" value={ctSel} onChange={(e) => setCtSel(e.target.value)}>
          <option value="">Contrato…</option>
          {cts.map((c) => {
            const v = vehs.find((x) => x.id === c.vehicleId);
            return <option key={c.id} value={c.id}>{v?.placa ?? "?"} · saldo {c.saldoInicial} · {c.omitirDomingos === 1 ? "sin domingos" : "con domingos"}</option>;
          })}
        </select>
        <input className="input font-mono-num" placeholder="Nuevo saldo inicial (vacío = no cambiar)" value={saldoEdit} onChange={(e) => setSaldoEdit(e.target.value)} />
        <button className="btn btn-ghost" onClick={guardarAjuste}>Guardar saldo / alternar domingos</button>
        {msgAjuste && <p className="text-sm text-sky-200">{msgAjuste}</p>}
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-bold">Omitir día específico (taller, etc.)</h2>
        <select className="input" value={omiCt} onChange={(e) => cargarOmis(e.target.value)}>
          <option value="">Contrato…</option>
          {cts.map((c) => {
            const v = vehs.find((x) => x.id === c.vehicleId);
            return <option key={c.id} value={c.id}>{v?.placa ?? "?"}</option>;
          })}
        </select>
        <input className="input" type="date" value={omiFecha} onChange={(e) => setOmiFecha(e.target.value)} />
        <input className="input" placeholder="Motivo" value={omiMotivo} onChange={(e) => setOmiMotivo(e.target.value)} />
        <button className="btn btn-ghost" onClick={crearOmision}>Omitir día (cuota 0)</button>
        {omis.length > 0 && (
          <div className="text-sm space-y-1">
            {omis.map((o) => (
              <div key={o.fecha} className="flex justify-between"><span>{o.fecha} · {o.motivo}</span><button className="text-red-300" onClick={() => borrarOmision(o.fecha)}>×</button></div>
            ))}
          </div>
        )}
        {msgOmi && <p className="text-sm text-sky-200">{msgOmi}</p>}
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-bold">4 · Nuevo usuario (conductor entra con teléfono)</h2>
        <input className="input" placeholder="300..." value={tel} onChange={(e) => setTel(e.target.value)} />
        <input className="input" type="password" placeholder="clave" value={pass} onChange={(e) => setPass(e.target.value)} />
        <select className="input" value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="conductor">conductor</option><option value="cobrador">cobrador</option>
          <option value="viewer">viewer</option><option value="admin">admin</option>
        </select>
        {rol === "conductor" && (
          <select className="input" value={cliLink} onChange={(e) => setCliLink(e.target.value)}>
            <option value="">Linkear a cliente… (obligatorio para ver deuda)</option>
            {clis.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.telefono}</option>)}
          </select>
        )}
        <button className="btn btn-primary" onClick={crearUser}>Crear usuario</button>
        {msgUser && <p className="text-sm text-sky-200">{msgUser}</p>}
      </div>
    </div>
  );
}
