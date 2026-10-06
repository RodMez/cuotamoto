import { identity } from "@/server/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/server/db";
import { contracts, vehicles, clients } from "@/server/db/schema";
import { getLedger } from "@/server/db/ledger";
import { fmtCOP } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Pendientes() {
  const me = await identity();
  if (!me) redirect("/login");
  if (me.rol === "conductor") redirect("/mi-cuenta");

  const cts = await db.select().from(contracts);
  const vehs = await db.select().from(vehicles);
  const clis = await db.select().from(clients);

  const rows: { placa: string; nombre: string; deuda: number; diasPend: number }[] = [];
  for (const ct of cts.filter((c) => c.activo === 1)) {
    const ledger = await getLedger(ct.id);
    const last = ledger[ledger.length - 1];
    const deuda = last?.deudaAcumulada ?? 0;
    if (deuda > 0) {
      const v = vehs.find((x) => x.id === ct.vehicleId);
      const cli = clis.find((x) => x.id === ct.clientId);
      rows.push({
        placa: v?.placa ?? "?",
        nombre: cli?.nombre ?? "?",
        deuda,
        diasPend: ledger.filter((r) => r.estado === "Pendiente").length,
      });
    }
  }
  rows.sort((a, b) => b.deuda - a.deuda);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-4">
      <h1 className="text-2xl font-bold">Pendientes — solo visual</h1>
      <Link className="btn btn-ghost" href="/">← Volver</Link>
      <div className="card p-4 space-y-2">
        {rows.length === 0 && <p className="text-emerald-300">Todo al día ✓</p>}
        {rows.map((r) => (
          <div key={r.placa} className="flex justify-between items-center py-2 border-b border-white/5">
            <div><p className="font-bold">{r.placa} · {r.nombre}</p><p className="text-xs text-slate-400">{r.diasPend} días pendientes</p></div>
            <span className={`badge ${r.diasPend > 3 ? "badge-pend" : "badge-pend"}`}>{fmtCOP(r.deuda)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
