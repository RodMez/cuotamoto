"use client";
import { useState } from "react";

export default function AdminPage() {
  const [placa, setPlaca] = useState("");
  const [cuota, setCuota] = useState("17000");
  const [alias, setAlias] = useState("");
  const [tel, setTel] = useState("");
  const [pass, setPass] = useState("");
  const [rol, setRol] = useState("conductor");
  const [msg, setMsg] = useState("");

  async function crearMoto() {
    const r = await fetch("/api/vehicles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placa, cuotaBase: Number(cuota), alias }),
    });
    setMsg(r.ok ? "moto creada" : (await r.json()).error);
  }
  async function crearUser() {
    const r = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: tel, password: pass, rol, nombre: tel }),
    });
    setMsg(r.ok ? "usuario creado" : (await r.json()).error);
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4 w-full">
      <h1 className="text-2xl font-bold">Admin</h1>
      <a className="btn btn-ghost" href="/">← Volver</a>
      <div className="card p-4 space-y-2">
        <h2 className="font-bold">Nueva moto (cuota base variable)</h2>
        <input className="input" placeholder="Placa PMO-002" value={placa} onChange={(e) => setPlaca(e.target.value)} />
        <input className="input" placeholder="Alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
        <input className="input font-mono-num" placeholder="17000" value={cuota} onChange={(e) => setCuota(e.target.value)} />
        <button className="btn btn-primary" onClick={crearMoto}>Crear moto</button>
      </div>
      <div className="card p-4 space-y-2">
        <h2 className="font-bold">Nuevo usuario (conductor entra con teléfono)</h2>
        <input className="input" placeholder="300..." value={tel} onChange={(e) => setTel(e.target.value)} />
        <input className="input" type="password" placeholder="clave" value={pass} onChange={(e) => setPass(e.target.value)} />
        <select className="input" value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="conductor">conductor</option><option value="cobrador">cobrador</option>
          <option value="viewer">viewer</option><option value="admin">admin</option>
        </select>
        <button className="btn btn-primary" onClick={crearUser}>Crear usuario</button>
      </div>
      {msg && <p className="text-sm text-sky-200">{msg}</p>}
    </div>
  );
}
