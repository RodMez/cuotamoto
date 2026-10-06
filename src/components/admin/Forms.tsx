"use client";
import { useState } from "react";
import { hoyBogota } from "@/lib/utils";
import type { Cli, Ct, Omi, Veh } from "./types";
import { Field, Modal } from "./ui";
import { useToast } from "./Toast";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error ?? "Error al guardar");
  return j;
}

export function MotoForm({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const [placa, setPlaca] = useState("");
  const [alias, setAlias] = useState("");
  const [cuota, setCuota] = useState("17000");
  const [busy, setBusy] = useState(false);
  const valid = placa.trim().length >= 4 && Number(cuota) > 0;
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto] md:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        try {
          await post("/api/vehicles", { placa, cuotaBase: Number(cuota), alias });
          push("ok", `Moto ${placa.toUpperCase()} creada`);
          setPlaca("");
          setAlias("");
          onDone();
        } catch (err) {
          push("err", err instanceof Error ? err.message : "No se pudo crear");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Placa">
        <input className="input font-mono-num uppercase" placeholder="PMO-002" value={placa} onChange={(e) => setPlaca(e.target.value)} required />
      </Field>
      <Field label="Alias">
        <input className="input" placeholder="Moto norte…" value={alias} onChange={(e) => setAlias(e.target.value)} />
      </Field>
      <Field label="Cuota base COP">
        <input className="input font-mono-num" inputMode="numeric" value={cuota} onChange={(e) => setCuota(e.target.value)} required />
      </Field>
      <button className="btn btn-primary" disabled={!valid || busy}>
        {busy ? "Guardando…" : "+ Crear moto"}
      </button>
    </form>
  );
}

export function ClienteForm({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [doc, setDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = nombre.trim().length >= 3 && /^[0-9+ ]{7,15}$/.test(tel.trim());
  return (
    <form
      className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        try {
          await post("/api/clients", { nombre, telefono: tel, documento: doc || undefined });
          push("ok", `Cliente ${nombre} creado`);
          setNombre("");
          setTel("");
          setDoc("");
          onDone();
        } catch (err) {
          push("err", err instanceof Error ? err.message : "No se pudo crear");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Nombre completo" hint="Conductor real">
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </Field>
      <Field label="Teléfono" hint="7-15 dígitos">
        <input className="input font-mono-num" inputMode="tel" placeholder="300…" value={tel} onChange={(e) => setTel(e.target.value)} required />
      </Field>
      <Field label="Documento (opcional)">
        <input className="input font-mono-num" value={doc} onChange={(e) => setDoc(e.target.value)} />
      </Field>
      <button className="btn btn-primary" disabled={!valid || busy}>
        {busy ? "Guardando…" : "+ Crear cliente"}
      </button>
    </form>
  );
}

export function ContratoWizard({ vehs, clis, cts, onDone }: { vehs: Veh[]; clis: Cli[]; cts: Ct[]; onDone: () => void }) {
  const { push } = useToast();
  const libres = vehs.filter((v) => !cts.some((c) => c.vehicleId === v.id && c.activo === 1));
  const [step, setStep] = useState(1);
  const [vehSel, setVehSel] = useState("");
  const [cliSel, setCliSel] = useState("");
  const [inicio, setInicio] = useState(hoyBogota());
  const [saldo, setSaldo] = useState("0");
  const [omitDom, setOmitDom] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!vehSel || !cliSel || busy) return;
    setBusy(true);
    try {
      await post("/api/contracts", {
        vehicleId: vehSel,
        clientId: cliSel,
        fechaInicio: inicio,
        saldoInicial: Number(saldo) || 0,
        omitirDomingos: omitDom ? 1 : 0,
      });
      push("ok", "Contrato creado (anteriores de la moto desactivados)");
      onDone();
    } catch (err) {
      push("err", err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <ol className="flex gap-2 text-xs font-semibold">
        {[1, 2, 3].map((n) => (
          <li key={n} className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 ${step === n ? "border-blue-500/50 bg-blue-500/10" : "border-white/10"}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${step >= n ? "bg-blue-600 text-white" : "bg-white/10"}`}>{n}</span>
            {n === 1 ? "Moto libre" : n === 2 ? "Cliente" : "Fechas y saldo"}
          </li>
        ))}
      </ol>
      {step === 1 && (
        <Field label={`Moto libre (${libres.length})`}>
          <select className="input" value={vehSel} onChange={(e) => setVehSel(e.target.value)}>
            <option value="">Selecciona…</option>
            {libres.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} · base {v.cuotaBase}
              </option>
            ))}
          </select>
        </Field>
      )}
      {step === 2 && (
        <Field label={`Cliente (${clis.length})`}>
          <select className="input" value={cliSel} onChange={(e) => setCliSel(e.target.value)}>
            <option value="">Selecciona…</option>
            {clis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {c.telefono}
              </option>
            ))}
          </select>
        </Field>
      )}
      {step === 3 && (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Fecha inicio">
            <input className="input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Field>
          <Field label="Saldo inicial (deuda vieja)" hint="0 si es nuevo">
            <input className="input font-mono-num" inputMode="numeric" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <input type="checkbox" checked={omitDom} onChange={(e) => setOmitDom(e.target.checked)} className="h-4 w-4 accent-amber-500" />
            Omitir domingos (cuota 0)
          </label>
        </div>
      )}
      <div className="flex gap-2">
        {step > 1 && (
          <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            ← Atrás
          </button>
        )}
        {step < 3 ? (
          <button
            className="btn btn-primary flex-1"
            disabled={(step === 1 && !vehSel) || (step === 2 && !cliSel)}
            onClick={() => setStep((s) => s + 1)}
          >
            Continuar →
          </button>
        ) : (
          <button className="btn btn-accent flex-1" disabled={!vehSel || !cliSel || busy} onClick={submit}>
            {busy ? "Creando…" : "Crear contrato"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AjusteModal({ cts, vehs, initialId, onClose, onDone }: { cts: Ct[]; vehs: Veh[]; initialId: string; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const [id, setId] = useState(initialId);
  const [saldo, setSaldo] = useState("");
  const [busy, setBusy] = useState(false);
  const ct = cts.find((c) => c.id === id);
  const v = vehs.find((x) => x.id === ct?.vehicleId);

  return (
    <Modal title={`Ajustar contrato ${v?.placa ?? ""}`} onClose={onClose}>
      <Field label="Contrato">
        <select className="input" value={id} onChange={(e) => setId(e.target.value)}>
          {cts.map((c) => {
            const vv = vehs.find((x) => x.id === c.vehicleId);
            return (
              <option key={c.id} value={c.id}>
                {vv?.placa ?? "?"} · saldo {c.saldoInicial} · {c.omitirDomingos === 1 ? "sin dom" : "con dom"}
              </option>
            );
          })}
        </select>
      </Field>
      <Field label="Nuevo saldo inicial (vacío = no cambiar)">
        <input className="input font-mono-num" inputMode="numeric" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
      </Field>
      {ct && <p className="text-xs text-slate-400">Al guardar se alterna domingos: actualmente {ct.omitirDomingos === 1 ? "SIN domingos" : "CON domingos"}. La deuda se recalcula sola.</p>}
      <div className="flex gap-2">
        <button
          className="btn btn-ghost flex-1"
          disabled={!id || busy}
          onClick={async () => {
            if (!ct) return;
            setBusy(true);
            try {
              const body: Record<string, unknown> = { contractId: id };
              if (saldo !== "") body.saldoInicial = Number(saldo);
              body.omitirDomingos = ct.omitirDomingos === 1 ? 0 : 1;
              const r = await fetch("/api/contracts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
              if (!r.ok) throw new Error((await r.json()).error ?? "Error");
              push("ok", "Ajuste guardado (deuda recalculada)");
              onDone();
              onClose();
            } catch (err) {
              push("err", err instanceof Error ? err.message : "No se pudo ajustar");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Guardando…" : "Guardar saldo / alternar domingos"}
        </button>
      </div>
    </Modal>
  );
}

export function OmisionesPanel({ cts, vehs, onChanged }: { cts: Ct[]; vehs: Veh[]; onChanged: () => void }) {
  const { push } = useToast();
  const [ctId, setCtId] = useState("");
  const [fecha, setFecha] = useState(hoyBogota());
  const [motivo, setMotivo] = useState("Taller");
  const [omis, setOmis] = useState<Omi[]>([]);
  const [busy, setBusy] = useState(false);

  async function load(id: string) {
    setCtId(id);
    if (!id) {
      setOmis([]);
      return;
    }
    const r = await fetch(`/api/omisiones?contractId=${id}`);
    setOmis((await r.json()).omisiones ?? []);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <Field label="Contrato">
          <select className="input" value={ctId} onChange={(e) => void load(e.target.value)}>
            <option value="">Selecciona…</option>
            {cts.map((c) => {
              const v = vehs.find((x) => x.id === c.vehicleId);
              return (
                <option key={c.id} value={c.id}>
                  {v?.placa ?? "?"} · {c.fechaInicio}
                </option>
              );
            })}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Motivo">
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Field>
        </div>
        <button
          className="btn btn-ghost w-full"
          disabled={!ctId || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await post("/api/omisiones", { contractId: ctId, fecha, motivo });
              push("ok", `Día ${fecha} omitido (cuota 0)`);
              await load(ctId);
              onChanged();
            } catch (err) {
              push("err", err instanceof Error ? err.message : "No se pudo omitir");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Guardando…" : "Omitir día (cuota 0)"}
        </button>
      </div>
      <div>
        <p className="field-label mb-2">Días omitidos ({omis.length})</p>
        {omis.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-500">
            {ctId ? "Sin omisiones para este contrato." : "Elige un contrato para ver sus omisiones."}
          </p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto scroll-thin pr-1">
            {omis.map((o) => (
              <li key={o.fecha} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                <span>
                  <span className="font-mono-num font-bold">{o.fecha}</span> <span className="text-slate-400">· {o.motivo}</span>
                </span>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                  aria-label={`Quitar omisión ${o.fecha}`}
                  onClick={async () => {
                    const r = await fetch(`/api/omisiones?contractId=${ctId}&fecha=${o.fecha}`, { method: "DELETE" });
                    if (r.ok) {
                      push("ok", "Omisión eliminada");
                      await load(ctId);
                      onChanged();
                    } else push("err", "No se pudo eliminar");
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function UsuarioForm({ clis, onDone }: { clis: Cli[]; onDone: () => void }) {
  const { push } = useToast();
  const [tel, setTel] = useState("");
  const [pass, setPass] = useState("");
  const [rol, setRol] = useState("conductor");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = tel.trim().length >= 5 && pass.length >= 4 && (rol !== "conductor" || link);
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_160px_1fr_auto] md:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        try {
          await post("/api/admin/users", {
            telefono: tel,
            password: pass,
            rol,
            nombre: tel,
            clientId: rol === "conductor" ? link : undefined,
          });
          push("ok", `Usuario ${tel} (${rol}) creado`);
          setTel("");
          setPass("");
          setLink("");
          onDone();
        } catch (err) {
          push("err", err instanceof Error ? err.message : "No se pudo crear");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Teléfono login">
        <input className="input font-mono-num" value={tel} onChange={(e) => setTel(e.target.value)} required />
      </Field>
      <Field label="Clave" hint="mín. 4 caracteres">
        <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required />
      </Field>
      <Field label="Rol">
        <select className="input" value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="conductor">conductor</option>
          <option value="cobrador">cobrador</option>
          <option value="viewer">viewer</option>
          <option value="admin">admin</option>
        </select>
      </Field>
      {rol === "conductor" ? (
        <Field label="Link a cliente *">
          <select className="input" value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">Selecciona…</option>
            {clis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {c.telefono}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="hidden md:block" />
      )}
      <button className="btn btn-primary" disabled={!valid || busy}>
        {busy ? "Creando…" : "+ Crear usuario"}
      </button>
    </form>
  );
}
