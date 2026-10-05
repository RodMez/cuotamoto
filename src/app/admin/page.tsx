"use client";
import { useEffect, useState } from "react";
import { todayISO } from "@/lib/utils";

type Veh = { id: string; placa: string; alias: string | null; cuotaBase: number };
type Cli = { id: string; nombre: string; telefono: string };
type Ct = { id: string; vehicleId: string; clientId: string; activo: number };

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
  const [msgCt, setMsgCt] = useState("");
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
      body: JSON.stringify({ vehicleId: vehSel, clientId: cliSel, fechaInicio: inicio }),
    });
    setMsgCt(r.ok ? "contrato creado (anteriores de la moto desactivados)" : (await r.json()).error);
    if (r.ok) refresh();
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
        <button className="btn btn-accent" onClick={crearContrato}>Crear contrato</button>
        {msgCt && <p className="text-sm text-sky-200">{msgCt}</p>}
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
