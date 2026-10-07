import { identity } from "@/server/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/server/db";
import { contracts, clients } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getLedger } from "@/server/db/ledger";
import { fmtCOP } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MiCuenta() {
  const me = await identity();
  if (!me) redirect("/login");
  const myId = me.id;
  const rol = me.rol;
  const clis = await db.select().from(clients);
  const mine = clis.find((c) => c.userId === myId);
  if (rol !== "conductor" || !mine) {
    // admin/cobrador no tienen mi-cuenta
    redirect("/");
  }
  const cts = await db.select().from(contracts).where(eq(contracts.clientId, mine.id));
  const ct = cts.find((c) => c.activo === 1) ?? cts[0];
  if (!ct) return <div className="p-8">Sin contrato activo.</div>;
  const ledger = await getLedger(ct.id);
  const last = ledger[ledger.length - 1];
  const deuda = last?.deudaAcumulada ?? ct.saldoInicial ?? 0;
  const credito = last?.credito ?? 0;
  const saldoInicial = ct.saldoInicial ?? 0;
  const totalCuotas = ledger.reduce((a, r) => a + r.cuotaDia, 0);
  const totalPagos = ledger.reduce((a, r) => a + r.totalPagado, 0);
  const diasExentos = ledger.filter((r) => r.exento).length;

  return (
    <div className="p-4 max-w-md mx-auto space-y-4 w-full">
      <h1 className="text-xl font-bold">Mi cuenta — {mine.nombre}</h1>
      <div className="card p-6 text-center">
        <p className="text-sm text-slate-300">DEBES HOY</p>
        <p className="font-mono-num text-3xl font-bold">{fmtCOP(deuda)}</p>
        {credito > 0 && <p className="text-sm text-emerald-300">Tienes {fmtCOP(credito)} a favor</p>}
        <p className={`badge mt-2 ${deuda <= 0 ? "badge-ok" : "badge-pend"}`}>{deuda <= 0 ? "✓ Al día" : "● Pendiente"}</p>
      </div>
      <div className="card p-4">
        <h2 className="font-bold mb-2">Desglose</h2>
        <div className="text-sm space-y-2">
          {saldoInicial > 0 && (
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-300">Saldo inicial</span>
              <span className="font-mono-num">+{fmtCOP(saldoInicial)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-300">
              Cuotas ({ledger.length} día{ledger.length === 1 ? "" : "s"}
              {diasExentos > 0 ? ` · ${diasExentos} exento${diasExentos === 1 ? "" : "s"}` : ""})
            </span>
            <span className="font-mono-num">+{fmtCOP(totalCuotas)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-300">Pagos recibidos</span>
            <span className="font-mono-num text-emerald-300">−{fmtCOP(totalPagos)}</span>
          </div>
          <div className="flex justify-between py-1 font-bold">
            <span>DEBES HOY</span>
            <span className="font-mono-num">{fmtCOP(deuda)}</span>
          </div>
          {credito > 0 && (
            <p className="text-sm text-emerald-300">Tienes {fmtCOP(credito)} a favor para los próximos días</p>
          )}
        </div>
      </div>
      <div className="card p-4">
        <h2 className="font-bold mb-2">Historial</h2>
        {ledger.slice().reverse().slice(0, 30).map((r) => (
          <div key={r.diaSeq} className="py-2 border-b border-white/5 text-sm">
            <div className="flex justify-between">
              <span>Día {r.diaSeq} · {r.fecha}</span>
              <span className="font-mono-num">{fmtCOP(r.totalPagado)} / {fmtCOP(r.cuotaDia)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>{r.exento ? `Exento${r.motivo ? ` — ${r.motivo}` : ""}` : ""}</span>
              <span className="font-mono-num ml-auto">Deuda tras el día: {fmtCOP(r.deudaAcumulada)}</span>
            </div>
          </div>
        ))}
      </div>
      <Link className="btn btn-ghost w-full text-center" href="/api/auth/signout">Salir</Link>
    </div>
  );
}
