import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { contracts, clients } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getLedger } from "@/server/db/ledger";
import { fmtCOP } from "@/lib/utils";

export const runtime = "nodejs";

export default async function MiCuenta() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  const myId = (s.user as unknown as { id: string }).id;
  const rol = (s.user as unknown as { rol: string }).rol;
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
  const deuda = last?.deudaAcumulada ?? 0;

  return (
    <div className="p-4 max-w-md mx-auto space-y-4 w-full">
      <h1 className="text-xl font-bold">Mi cuenta — {mine.nombre}</h1>
      <div className="card p-6 text-center">
        <p className="text-sm text-slate-300">DEBES HOY</p>
        <p className="font-mono-num text-3xl font-bold">{fmtCOP(deuda)}</p>
        <p className={`badge mt-2 ${deuda <= 0 ? "badge-ok" : "badge-pend"}`}>{deuda <= 0 ? "✓ Al día" : "● Pendiente"}</p>
      </div>
      <div className="card p-4">
        <h2 className="font-bold mb-2">Historial</h2>
        {ledger.slice().reverse().slice(0, 30).map((r) => (
          <div key={r.diaSeq} className="flex justify-between py-2 border-b border-white/5 text-sm">
            <span>Día {r.diaSeq} · {r.fecha}</span>
            <span className="font-mono-num">{fmtCOP(r.totalPagado)} / {fmtCOP(r.cuotaDia)}</span>
          </div>
        ))}
      </div>
      <a className="btn btn-ghost w-full text-center" href="/api/auth/signout">Salir</a>
    </div>
  );
}
