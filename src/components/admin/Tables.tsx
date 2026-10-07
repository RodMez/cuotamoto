"use client";
import { useMemo, useState } from "react";
import { fmtCOP } from "@/lib/utils";
import type { Cli, ContractHealth, Ct, Usuario, Veh } from "./types";
import { Empty, SkeletonRows } from "./ui";

function useSort() {
  const [key, setKey] = useState<string>("");
  const [dir, setDir] = useState<1 | -1>(1);
  const toggle = (k: string) => {
    if (key === k) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setKey(k);
      setDir(1);
    }
  };
  return { key, dir, toggle };
}

function Th({ label, onClick, active, dir }: { label: string; onClick?: () => void; active?: boolean; dir?: 1 | -1 }) {
  return (
    <th>
      {onClick ? (
        <button onClick={onClick} className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-white">
          {label} <span aria-hidden>{active ? (dir === 1 ? "▲" : "▼") : "·"}</span>
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function FleetTable({
  vehs,
  cts,
  health,
  loading,
  query,
}: {
  vehs: Veh[];
  cts: Ct[];
  health: Record<string, ContractHealth>;
  loading: boolean;
  query: string;
}) {
  const { key, dir, toggle } = useSort();
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeByVeh = new Map(cts.filter((c) => c.activo === 1).map((c) => [c.vehicleId, c]));
    let list = vehs.map((v) => {
      const ct = activeByVeh.get(v.id);
      const h = ct ? health[ct.id] : undefined;
      return { v, ct, deuda: h?.deuda ?? ct?.saldoInicial ?? 0, diasPend: h?.diasPend ?? 0, libre: !ct };
    });
    if (q) list = list.filter((r) => `${r.v.placa} ${r.v.alias ?? ""}`.toLowerCase().includes(q));
    if (key === "placa") list = [...list].sort((a, b) => dir * a.v.placa.localeCompare(b.v.placa));
    if (key === "deuda") list = [...list].sort((a, b) => dir * (a.deuda - b.deuda));
    if (key === "dias") list = [...list].sort((a, b) => dir * (a.diasPend - b.diasPend));
    if (key === "cuota") list = [...list].sort((a, b) => dir * (a.v.cuotaBase - b.v.cuotaBase));
    return list;
  }, [vehs, cts, health, query, key, dir]);

  if (loading) return <SkeletonRows n={5} />;
  if (rows.length === 0) return <Empty title="Sin motos" hint="Crea la primera moto con placa y cuota base." />;

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="dense w-full min-w-[640px]">
        <thead className="sticky top-0 bg-[#101a34]">
          <tr>
            <Th label="Placa" onClick={() => toggle("placa")} active={key === "placa"} dir={dir} />
            <Th label="Cuota base" onClick={() => toggle("cuota")} active={key === "cuota"} dir={dir} />
            <th>Estado</th>
            <Th label="Deuda" onClick={() => toggle("deuda")} active={key === "deuda"} dir={dir} />
            <Th label="Días pend." onClick={() => toggle("dias")} active={key === "dias"} dir={dir} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.v.id}>
              <td>
                <p className="font-bold">{r.v.placa}</p>
                {r.v.alias && <p className="text-xs text-slate-400">{r.v.alias}</p>}
              </td>
              <td className="font-mono-num">{fmtCOP(r.v.cuotaBase)}</td>
              <td>
                {r.libre ? (
                  <span className="badge badge-ok">Libre</span>
                ) : (
                  <span className="badge badge-pend">Ocupada</span>
                )}
              </td>
              <td className="font-mono-num font-bold">{fmtCOP(r.deuda)}</td>
              <td className="font-mono-num">{r.diasPend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClientsTable({ clis, cts, loading, query }: { clis: Cli[]; cts: Ct[]; loading: boolean; query: string }) {
  const [page, setPage] = useState(0);
  const per = 10;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const countByClient = new Map<string, number>();
    for (const c of cts) countByClient.set(c.clientId, (countByClient.get(c.clientId) ?? 0) + 1);
    let list = clis.map((c) => ({ c, n: countByClient.get(c.id) ?? 0 }));
    if (q) list = list.filter((r) => `${r.c.nombre} ${r.c.telefono}`.toLowerCase().includes(q));
    return list.sort((a, b) => a.c.nombre.localeCompare(b.c.nombre));
  }, [clis, cts, query]);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const view = rows.slice(page * per, page * per + per);

  if (loading) return <SkeletonRows n={5} />;
  if (rows.length === 0) return <Empty title="Sin clientes" hint="Crea el conductor real con nombre y teléfono." />;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto scroll-thin">
        <table className="dense w-full min-w-[560px]">
          <thead className="sticky top-0 bg-[#101a34]">
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Contratos</th>
              <th>Acceso app</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.c.id}>
                <td className="font-semibold">{r.c.nombre}</td>
                <td className="font-mono-num">{r.c.telefono}</td>
                <td className="font-mono-num">{r.n}</td>
                <td>{r.c.userId ? <span className="badge badge-ok">✓ Vinculado</span> : <span className="badge badge-pend">Sin usuario</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {page + 1}/{pages} · {rows.length} clientes
          </span>
          <div className="flex gap-2">
            <button className="btn btn-ghost !min-h-[36px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ←
            </button>
            <button className="btn btn-ghost !min-h-[36px]" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ContractsTable({
  cts,
  vehs,
  clis,
  health,
  loading,
  query,
  filter,
  onAjustar,
}: {
  cts: Ct[];
  vehs: Veh[];
  clis: Cli[];
  health: Record<string, ContractHealth>;
  loading: boolean;
  query: string;
  filter: "todos" | "pendientes" | "aldia";
  onAjustar: (id: string) => void;
}) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cts.map((c) => {
      const v = vehs.find((x) => x.id === c.vehicleId);
      const cli = clis.find((x) => x.id === c.clientId);
      const h = health[c.id];
      return { c, placa: v?.placa ?? "?", cliente: cli?.nombre ?? "?", deuda: h?.deuda ?? c.saldoInicial, pend: h?.diasPend ?? 0 };
    });
    if (q) list = list.filter((r) => `${r.placa} ${r.cliente}`.toLowerCase().includes(q));
    if (filter === "pendientes") list = list.filter((r) => r.pend > 0 || r.deuda > 0);
    if (filter === "aldia") list = list.filter((r) => r.pend === 0 && r.deuda <= 0);
    return list.sort((a, b) => b.deuda - a.deuda);
  }, [cts, vehs, clis, health, query, filter]);

  if (loading) return <SkeletonRows n={5} />;
  if (rows.length === 0) return <Empty title="Sin contratos" hint="Usa el wizard: moto libre + cliente + fecha de inicio." />;
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="dense w-full min-w-[720px]">
        <thead className="sticky top-0 bg-[#101a34]">
          <tr>
            <th>Moto / Cliente</th>
            <th>Inicio</th>
            <th>Saldo inicial</th>
            <th>Domingos</th>
            <th>Deuda viva</th>
            <th>Estado</th>
            <th><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.c.id}>
              <td>
                <p className="font-bold">
                  {r.placa} · {r.cliente}
                </p>
                <p className="font-mono-num text-xs text-slate-500">{r.c.activo === 1 ? "activo" : "inactivo"} · {r.c.id.slice(0, 6)}</p>
              </td>
              <td className="font-mono-num">{r.c.fechaInicio}</td>
              <td className="font-mono-num">{fmtCOP(r.c.saldoInicial)}</td>
              <td>{r.c.omitirDomingos === 1 ? <span className="badge badge-ok">Sin domingos</span> : <span className="badge badge-pend">Con domingos</span>}</td>
              <td className="font-mono-num font-bold">{fmtCOP(r.deuda)}</td>
              <td>
                {r.pend === 0 && r.deuda <= 0 ? <span className="badge badge-ok">✓ Al día</span> : <span className="badge badge-pend">● {r.pend} pend.</span>}
              </td>
              <td>
                <button className="btn btn-ghost !min-h-[36px] text-xs" onClick={() => onAjustar(r.c.id)}>
                  Ajustar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROL_BADGE: Record<string, string> = {
  admin: "badge-ok",
  viewer: "badge-pend",
};

export function UsersTable({
  users,
  loading,
  query,
  onEditar,
  onActivar,
  onBorrar,
}: {
  users: Usuario[];
  loading: boolean;
  query: string;
  onEditar: (u: Usuario) => void;
  onActivar: (u: Usuario) => void;
  onBorrar: (u: Usuario) => void;
}) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...users];
    if (q)
      list = list.filter((u) =>
        `${u.name ?? ""} ${u.email ?? ""} ${u.telefono ?? ""} ${u.rol}`.toLowerCase().includes(q),
      );
    return list.sort((a, b) => (a.telefono ?? a.email ?? "").localeCompare(b.telefono ?? b.email ?? ""));
  }, [users, query]);

  if (loading) return <SkeletonRows n={4} />;
  if (rows.length === 0) return <Empty title="Sin usuarios" hint="Crea el primero con teléfono y rol." />;
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="dense w-full min-w-[680px]">
        <thead className="sticky top-0 bg-[#101a34]">
          <tr>
            <th>Usuario</th>
            <th>Teléfono</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Cliente</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className={u.activo === 0 ? "opacity-60" : ""}>
              <td className="font-semibold">{u.name ?? u.telefono ?? u.email ?? "—"}</td>
              <td className="font-mono-num">{u.telefono ?? "—"}</td>
              <td>
                <span className={`badge ${ROL_BADGE[u.rol] ?? ""}`}>{u.rol}</span>
              </td>
              <td>
                {u.activo === 1 ? (
                  <span className="badge badge-ok">Activo</span>
                ) : (
                  <span className="badge badge-pend">Inactivo</span>
                )}
              </td>
              <td className="text-sm text-slate-300">{u.cliente?.nombre ?? "—"}</td>
              <td>
                <div className="flex gap-1">
                  <button className="btn btn-ghost !min-h-[36px] text-xs" onClick={() => onEditar(u)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-ghost !min-h-[36px] text-xs"
                    title={u.activo === 1 ? "Bloquea el acceso al instante" : "Reactiva el acceso"}
                    onClick={() => onActivar(u)}
                  >
                    {u.activo === 1 ? "Desactivar" : "Reactivar"}
                  </button>
                  {u.borrable && (
                    <button
                      className="btn btn-ghost !min-h-[36px] text-xs text-red-300"
                      title="Solo sin historial"
                      onClick={() => onBorrar(u)}
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
