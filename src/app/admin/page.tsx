"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bike,
  CalendarX,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  Wallet,
  TriangleAlert,
  TrendingUp,
  CircleCheckBig,
} from "lucide-react";
import { fmtCOP, hoyBogota } from "@/lib/utils";
import { useAdminData } from "@/components/admin/useAdminData";
import { useToast, ToastProvider } from "@/components/admin/Toast";
import { AjusteModal, ClienteForm, ContratoWizard, MotoForm, OmisionesPanel, UserEditModal, UsuarioForm, delJSON, nombreUsuario, patchJSON } from "@/components/admin/Forms";
import { AreaTrend, Donut, TopBars } from "@/components/admin/Charts";
import { Bullet, KpiCard } from "@/components/admin/Kpi";
import { ClientsTable, ContractsTable, FleetTable, UsersTable } from "@/components/admin/Tables";
import { Confirm } from "@/components/admin/ui";
import type { Usuario } from "@/components/admin/types";

type Tab = "overview" | "motos" | "clientes" | "contratos" | "omisiones" | "usuarios";

const TABS: { id: Tab; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "overview", label: "Resumen", icon: <LayoutDashboard size={16} />, hint: "KPIs, deuda y recaudo" },
  { id: "motos", label: "Motos", icon: <Bike size={16} />, hint: "Flota y cuota base" },
  { id: "clientes", label: "Clientes", icon: <Users size={16} />, hint: "Conductores reales" },
  { id: "contratos", label: "Contratos", icon: <FileText size={16} />, hint: "1 activo por moto" },
  { id: "omisiones", label: "Omisiones", icon: <CalendarX size={16} />, hint: "Taller y exentos" },
  { id: "usuarios", label: "Usuarios", icon: <UserPlus size={16} />, hint: "Accesos por rol" },
];

function AdminInner() {
  const { snapshot, usuarios, loading, refreshing, error, lastUpdated, refresh } = useAdminData();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [ctFilter, setCtFilter] = useState<"todos" | "pendientes" | "aldia">("todos");
  const [ajusteId, setAjusteId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<Usuario | null>(null);
  const [confirmUser, setConfirmUser] = useState<{ u: Usuario; accion: "activar" | "borrar" } | null>(null);
  const [busyUser, setBusyUser] = useState(false);
  const [meta, setMeta] = useState("500000");

  async function activarUsuario(u: Usuario) {
    setBusyUser(true);
    try {
      await patchJSON("/api/admin/users", { userId: u.id, activo: u.activo === 1 ? 0 : 1 });
      push("ok", u.activo === 1 ? `${nombreUsuario(u)} desactivado (acceso bloqueado)` : `${nombreUsuario(u)} reactivado`);
      setConfirmUser(null);
      void refresh(true);
    } catch (e) {
      push("err", e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setBusyUser(false);
    }
  }

  async function borrarUsuario(u: Usuario) {
    setBusyUser(true);
    try {
      await delJSON(`/api/admin/users?id=${u.id}`);
      push("ok", `${nombreUsuario(u)} borrado`);
      setConfirmUser(null);
      void refresh(true);
    } catch (e) {
      push("err", e instanceof Error ? e.message : "No se pudo borrar");
    } finally {
      setBusyUser(false);
    }
  }

  const mes = hoyBogota().slice(0, 7);
  const pendContratos = snapshot.contratosActivos.filter((c) => (snapshot.healthByContract[c.id]?.diasPend ?? 0) > 0).length;
  const okContratos = snapshot.contratosActivos.length - pendContratos;

  const serie = useMemo(
    () =>
      snapshot.serieDeuda14d.length > 0
        ? snapshot.serieDeuda14d
        : [{ fecha: hoyBogota(), deuda: snapshot.deudaTotal, recaudo: snapshot.recaudoMesTotal }],
    [snapshot],
  );

  return (
    <div className="min-h-screen">
      {/* Header sticky */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B1226]/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 md:px-6">
          <Link href="/" className="btn btn-ghost !min-h-[36px] !px-2.5 text-sm" aria-label="Volver al inicio">
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Volver</span>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold md:text-base">
              Admin <span className="text-slate-500">·</span> <span className="text-slate-300">CuotaMoto</span>
            </h1>
            <p className="hidden truncate text-[11px] text-slate-500 md:block">
              {TABS.find((t) => t.id === tab)?.hint} {lastUpdated && `· actualizado ${lastUpdated}`}
              {refreshing && " · actualizando…"}
            </p>
          </div>
          <div className="relative hidden w-56 md:block">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input !min-h-[36px] !pl-8 !text-[13px]"
              placeholder="Buscar placa, cliente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Búsqueda global"
            />
          </div>
          <button className="btn btn-ghost !min-h-[36px] !px-2.5 text-sm" onClick={() => void refresh(true)} disabled={loading || refreshing}>
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> <span className="hidden sm:inline">{refreshing ? "…" : "Actualizar"}</span>
          </button>
          <Link href="/pendientes" className="btn btn-ghost !min-h-[36px] !px-2.5 text-sm">
            Pendientes
          </Link>
        </div>
        {/* Tabs scroll horizontal */}
        <nav className="mx-auto w-full max-w-7xl overflow-x-auto scroll-thin px-3 pb-2 md:px-6" aria-label="Secciones admin">
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-all ${
                  tab === t.id ? "tab-active" : "border-white/10 text-slate-300 hover:border-white/25 hover:bg-white/5"
                }`}
              >
                {t.icon}
                {t.label}
                {t.id === "contratos" && snapshot.contratosActivos.length > 0 && (
                  <span className="rounded-full bg-white/15 px-1.5 font-mono-num text-[11px]">{snapshot.contratosActivos.length}</span>
                )}
                {t.id === "motos" && snapshot.motosLibres.length > 0 && (
                  <span className="rounded-full bg-emerald-500/25 px-1.5 font-mono-num text-[11px] text-emerald-200">{snapshot.motosLibres.length} libres</span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-3 px-3 py-4 md:px-6 md:py-6">
        {/* Búsqueda móvil */}
        <div className="relative md:hidden">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input !pl-8"
            placeholder="Buscar placa, cliente…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Búsqueda global"
          />
        </div>

        {error && (
          <div className="card card-pad flex flex-wrap items-center justify-between gap-2 border-red-500/30 text-sm">
            <p className="text-red-200">No se pudo cargar: {error}</p>
            <button className="btn btn-ghost !min-h-[36px] text-sm" onClick={() => void refresh(false)}>
              Reintentar
            </button>
          </div>
        )}

        {/* KPI row siempre visible */}
        <section aria-label="Indicadores" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <KpiCard
            label="Deuda total flota"
            value={fmtCOP(snapshot.deudaTotal)}
            sub={`${snapshot.contratosActivos.length} contratos activos`}
            icon={<Wallet size={20} />}
            accent="red"
            loading={loading}
          />
          <KpiCard
            label="Días pendientes"
            value={String(snapshot.diasPendTotal)}
            sub={`${pendContratos} contratos con mora`}
            icon={<TriangleAlert size={20} />}
            accent="amber"
            loading={loading}
          />
          <KpiCard
            label={`Recaudo ${mes}`}
            value={fmtCOP(snapshot.recaudoMesTotal)}
            sub="Suma pagos del mes"
            icon={<TrendingUp size={20} />}
            accent="green"
            loading={loading}
          />
          <KpiCard
            label="Flota"
            value={`${snapshot.motosLibres.length}/${snapshot.vehs.length} libres`}
            sub={`${snapshot.motosOcupadas.length} ocupadas`}
            icon={<Bike size={20} />}
            accent="blue"
            loading={loading}
          />
        </section>

        {tab === "overview" && (
          <>
            <section className="grid gap-3 lg:grid-cols-12">
              <div className="card card-pad lg:col-span-7">
                <AreaTrend data={serie} title="Recaudo diario · últimos 14 días" />
              </div>
              <div className="card card-pad space-y-4 lg:col-span-5">
                <Donut ok={okContratos} pend={pendContratos} title="Salud de contratos" />
                <div className="border-t border-white/5 pt-3">
                  <Bullet label="Meta recaudo mes" value={snapshot.recaudoMesTotal} target={Number(meta) || 1} />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Meta COP:</span>
                    <input className="input !min-h-[34px] !w-36 font-mono-num !text-xs" inputMode="numeric" value={meta} onChange={(e) => setMeta(e.target.value)} aria-label="Meta de recaudo" />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-12">
              <div className="card card-pad lg:col-span-7">
                <TopBars
                  title="Top deudores (por moto)"
                  items={snapshot.topDeudores.map((t) => ({ label: t.placa, sub: `${t.cliente} · ${t.diasPend}d`, value: t.deuda }))}
                />
                <div className="mt-3">
                  <button className="btn btn-ghost w-full !min-h-[36px] text-sm" onClick={() => setTab("contratos")}>
                    Ver todos los contratos →
                  </button>
                </div>
              </div>
              <div className="space-y-3 lg:col-span-5">
                <div className="card card-pad space-y-2">
                  <p className="text-sm font-bold">Acciones rápidas</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn btn-primary !text-[13px]" onClick={() => setTab("motos")}>
                      + Moto
                    </button>
                    <button className="btn btn-primary !text-[13px]" onClick={() => setTab("clientes")}>
                      + Cliente
                    </button>
                    <button className="btn btn-accent !text-[13px]" onClick={() => setTab("contratos")}>
                      + Contrato
                    </button>
                    <button className="btn btn-ghost !text-[13px]" onClick={() => setTab("omisiones")}>
                      Omitir día
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Flujo producción: 1 moto → 2 cliente → 3 contrato → 4 usuario. Sin demos.</p>
                </div>
                <div className="card card-pad">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold">Flota ahora</p>
                    <button className="text-xs text-sky-300 hover:underline" onClick={() => setTab("motos")}>
                      Gestionar →
                    </button>
                  </div>
                  <FleetTable vehs={snapshot.vehs.slice(0, 5)} cts={snapshot.cts} health={snapshot.healthByContract} loading={loading} query="" />
                  {snapshot.vehs.length > 5 && <p className="mt-1 text-xs text-slate-500">Mostrando 5 de {snapshot.vehs.length}.</p>}
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "motos" && (
          <section className="grid gap-3 lg:grid-cols-12">
            <div className="card card-pad lg:col-span-7">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">Flota ({snapshot.vehs.length}) · {snapshot.motosLibres.length} libres</h2>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <CircleCheckBig size={14} /> Click en cabecera para ordenar
                </span>
              </div>
              <FleetTable vehs={snapshot.vehs} cts={snapshot.cts} health={snapshot.healthByContract} loading={loading} query={query} />
            </div>
            <div className="space-y-3 lg:col-span-5">
              <div className="card card-pad space-y-3">
                <h2 className="text-sm font-bold">1 · Nueva moto</h2>
                <MotoForm onDone={() => void refresh(true)} />
              </div>
              <div className="card card-pad text-xs leading-relaxed text-slate-400">
                <p className="font-bold text-slate-200">Reglas</p>
                <p>· Placa única en mayúsculas. · Cuota base variable por moto (ej 17000). · Solo motos libres aparecen en el wizard de contrato.</p>
              </div>
            </div>
          </section>
        )}

        {tab === "clientes" && (
          <section className="grid gap-3 lg:grid-cols-12">
            <div className="card card-pad lg:col-span-7">
              <h2 className="mb-2 text-sm font-bold">Clientes ({snapshot.clis.length})</h2>
              <ClientsTable clis={snapshot.clis} cts={snapshot.cts} loading={loading} query={query} />
            </div>
            <div className="space-y-3 lg:col-span-5">
              <div className="card card-pad space-y-3">
                <h2 className="text-sm font-bold">2 · Nuevo cliente</h2>
                <ClienteForm onDone={() => void refresh(true)} />
              </div>
              <div className="card card-pad text-xs leading-relaxed text-slate-400">
                <p className="font-bold text-slate-200">Importante</p>
                <p>· Teléfono único, formato 7-15 dígitos. · El conductor solo ve su deuda si su usuario está linkeado (tab Usuarios).</p>
              </div>
            </div>
          </section>
        )}

        {tab === "contratos" && (
          <section className="grid gap-3 lg:grid-cols-12">
            <div className="card card-pad lg:col-span-7">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold">Contratos ({snapshot.cts.length})</h2>
                <div className="flex gap-1.5 text-xs" role="group" aria-label="Filtro estado">
                  {(["todos", "pendientes", "aldia"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setCtFilter(f)}
                      className={`rounded-lg border px-2.5 py-1.5 font-semibold ${ctFilter === f ? "tab-active" : "border-white/10 text-slate-400"}`}
                    >
                      {f === "todos" ? "Todos" : f === "pendientes" ? "Con mora" : "Al día"}
                    </button>
                  ))}
                </div>
              </div>
              <ContractsTable
                cts={snapshot.cts}
                vehs={snapshot.vehs}
                clis={snapshot.clis}
                health={snapshot.healthByContract}
                loading={loading}
                query={query}
                filter={ctFilter}
                onAjustar={(id) => setAjusteId(id)}
              />
            </div>
            <div className="space-y-3 lg:col-span-5">
              <div className="card card-pad space-y-3">
                <h2 className="text-sm font-bold">3 · Nuevo contrato (wizard)</h2>
                {snapshot.motosLibres.length === 0 && !loading ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    No hay motos libres. Crea una moto o finaliza un contrato antes.
                  </p>
                ) : (
                  <ContratoWizard vehs={snapshot.vehs} clis={snapshot.clis} cts={snapshot.cts} onDone={() => void refresh(true)} />
                )}
              </div>
              <div className="card card-pad text-xs leading-relaxed text-slate-400">
                <p className="font-bold text-slate-200">Regla producción</p>
                <p>· 1 activo por moto: crear uno nuevo desactiva los anteriores. · La deuda se recalcula sola desde saldo inicial + cuotas − pagos.</p>
              </div>
            </div>
          </section>
        )}

        {tab === "omisiones" && (
          <section className="card card-pad">
            <h2 className="mb-1 text-sm font-bold">Omitir día específico</h2>
            <p className="mb-3 text-xs text-slate-500">Taller, mantenimiento, etc. El día queda con cuota 0 y motivo visible en el ledger.</p>
            <OmisionesPanel cts={snapshot.cts} vehs={snapshot.vehs} onChanged={() => void refresh(true)} />
          </section>
        )}

        {tab === "usuarios" && (
          <section className="grid gap-3">
            <div className="card card-pad">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">
                  Usuarios <span className="font-mono-num text-slate-400">({usuarios.length})</span>
                </h2>
              </div>
              <UsersTable
                users={usuarios}
                loading={loading}
                query={query}
                onEditar={(u) => setEditUser(u)}
                onActivar={(u) => setConfirmUser({ u, accion: "activar" })}
                onBorrar={(u) => setConfirmUser({ u, accion: "borrar" })}
              />
            </div>
            <div className="card card-pad lg:col-span-8">
              <h2 className="mb-3 text-sm font-bold">4 · Nuevo usuario</h2>
              <UsuarioForm clis={snapshot.clis} onDone={() => void refresh(true)} />
            </div>
            <div className="card card-pad space-y-2 text-xs leading-relaxed text-slate-400 lg:col-span-4">
              <p className="text-sm font-bold text-slate-200">Roles</p>
              <p><span className="font-mono-num text-slate-200">admin</span> · todo, ajustes y omisiones.</p>
              <p><span className="font-mono-num text-slate-200">cobrador</span> · cobra y genera días (no futuro).</p>
              <p><span className="font-mono-num text-slate-200">conductor</span> · entra con teléfono, solo ve su deuda (requiere link a cliente).</p>
              <p><span className="font-mono-num text-slate-200">viewer</span> · lectura global.</p>
              <p>Desactivar bloquea el acceso al instante. Borrar solo funciona sin historial.</p>
            </div>
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>
            Deuda = max(0, anterior + cuota − pagos), arranca en saldo inicial. Cada pago queda fechado el día que se hizo.
          </span>
          <span className="font-mono-num">/admin · {snapshot.vehs.length} motos · {snapshot.clis.length} clientes</span>
        </footer>
      </main>

      {ajusteId && (
        <AjusteModal
          cts={snapshot.cts}
          vehs={snapshot.vehs}
          initialId={ajusteId}
          onClose={() => setAjusteId(null)}
          onDone={() => void refresh(true)}
        />
      )}

      {editUser && (
        <UserEditModal
          user={editUser}
          clis={snapshot.clis}
          onClose={() => setEditUser(null)}
          onDone={() => void refresh(true)}
        />
      )}

      {confirmUser?.accion === "activar" && (
        <Confirm
          title={confirmUser.u.activo === 1 ? "Desactivar usuario" : "Reactivar usuario"}
          text={
            confirmUser.u.activo === 1
              ? `${nombreUsuario(confirmUser.u)} perderá el acceso al instante. Sus pagos y auditoría se conservan.`
              : `${nombreUsuario(confirmUser.u)} podrá entrar de nuevo con su teléfono y clave.`
          }
          confirmLabel={confirmUser.u.activo === 1 ? "Desactivar" : "Reactivar"}
          busy={busyUser}
          onCancel={() => setConfirmUser(null)}
          onConfirm={() => void activarUsuario(confirmUser.u)}
        />
      )}

      {confirmUser?.accion === "borrar" && (
        <Confirm
          title="Borrar usuario"
          text={`${nombreUsuario(confirmUser.u)} se elimina para siempre. Solo permitido sin historial.`}
          confirmLabel="Borrar"
          busy={busyUser}
          onCancel={() => setConfirmUser(null)}
          onConfirm={() => void borrarUsuario(confirmUser.u)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <ToastProvider>
      <AdminInner />
    </ToastProvider>
  );
}
