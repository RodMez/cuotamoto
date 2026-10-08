"use client";
import { fmtCOP } from "@/lib/utils";

export type LedgerTablePago = { id: string; monto: number; metodo: string; nota: string | null };

export type LedgerTableRow = {
  diaSeq: number;
  fecha: string;
  cuotaDia: number;
  exento: boolean;
  motivo: string | null;
  totalPagado: number;
  deudaAcumulada: number;
  estado: string;
  pagos: LedgerTablePago[];
};

/**
 * La MISMA tabla del admin, reutilizada en la vista del conductor.
 * canEdit=false oculta el borrado (el servidor igual responde 403).
 */
export function LedgerTable({
  rows,
  canEdit,
  onBorrar,
}: {
  rows: LedgerTableRow[];
  canEdit: boolean;
  onBorrar?: (id: string) => void;
}) {
  return (
    <table className="dense w-full min-w-[580px]">
      <thead><tr><th>Día</th><th>Fecha</th><th>Cuota</th><th>Pagos del día</th><th>Deuda</th><th>Estado</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.fecha} className={r.exento ? "opacity-70" : ""}>
            <td className="font-mono-num font-bold">{r.diaSeq}</td>
            <td>{r.fecha}{r.exento && <div className="text-xs text-slate-400">Exento{r.motivo ? ` — ${r.motivo}` : ""}</div>}</td>
            <td className="font-mono-num">{r.exento ? "0" : fmtCOP(r.cuotaDia)}</td>
            <td className="font-mono-num">
              {fmtCOP(r.totalPagado)}
              {r.pagos.length > 1 && <span className="text-xs text-sky-300"> ({r.pagos.length})</span>}
              {r.pagos.length > 0 && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {r.pagos.map((p) => (
                    <div key={p.id} className="flex gap-1 items-center leading-tight">
                      <span>{fmtCOP(p.monto)} {p.metodo}{p.nota ? ` · ${p.nota}` : ""}</span>
                      {canEdit && (
                        <button className="text-red-300 hover:text-red-200 px-1.5 py-0.5" title="Borrar pago (admin)" onClick={() => onBorrar?.(p.id)}>×</button>
                      )}
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
  );
}
