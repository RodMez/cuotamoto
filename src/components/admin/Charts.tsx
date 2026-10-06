"use client";
import { fmtCOP } from "@/lib/utils";
import { barWidthPct, donutGeom, DONUT_R, points, topMax } from "@/lib/chart-math";

export function Spark({ values, stroke = "#3B82F6" }: { values: number[]; stroke?: string }) {
  const w = 120;
  const h = 36;
  const pts = points(values, w, h);
  const area = pts ? `6,${h - 6} ${pts} ${w - 6},${h - 6}` : "";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-[120px]" role="img" aria-label={`Tendencia: ${values.join(", ")}`}>
      {area && <polygon points={area} fill={stroke} opacity={0.18} />}
      {pts && <polyline points={pts} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export function AreaTrend({
  data,
  title,
}: {
  data: { fecha: string; deuda: number; recaudo: number }[];
  title: string;
}) {
  const w = 560;
  const h = 180;
  const vals = data.map((d) => d.recaudo);
  const pts = points(vals, w, h, 12);
  const area = pts ? `12,${h - 12} ${pts} ${w - 12},${h - 12}` : "";
  const max = Math.max(...vals, 1);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold">{title}</p>
        <p className="font-mono-num text-xs text-slate-400">
          máx {fmtCOP(max)} · {data.length} días
        </p>
      </div>
      {data.length < 2 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-400">
          Aún no hay suficientes días para graficar. Genera días o registra pagos.
        </p>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full" role="img" aria-label={`${title}. Valores: ${vals.join(", ")}`}>
          <defs>
            <linearGradient id="adm-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={12} x2={w - 12} y1={h * f} y2={h * f} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
          ))}
          {area && <polygon points={area} fill="url(#adm-area)" />}
          {pts && (
            <polyline points={pts} fill="none" stroke="#60A5FA" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {(() => {
            if (!pts) return null;
            const arr = pts.split(" ");
            return arr.map((p, i) => {
              const [x, y] = p.split(",").map(Number);
              const d = data[i];
              return (
                <g key={d.fecha}>
                  <circle cx={x} cy={y} r={8} fill="transparent">
                    <title>
                      {d.fecha}: {fmtCOP(d.recaudo)}
                    </title>
                  </circle>
                  <circle cx={x} cy={y} r={2.5} fill="#93C5FD" />
                </g>
              );
            });
          })()}
        </svg>
      )}
      <table className="sr-only">
        <caption>{title} en tabla</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.fecha}>
              <th>{d.fecha}</th>
              <td>{d.recaudo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 overflow-x-auto scroll-thin pb-1 text-[11px] text-slate-500">
        {data.slice(-7).map((d) => (
          <span key={d.fecha} className="whitespace-nowrap font-mono-num">
            {d.fecha.slice(5)} · {fmtCOP(d.recaudo)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TopBars({
  items,
  title,
}: {
  items: { label: string; sub?: string; value: number }[];
  title: string;
}) {
  const max = topMax(items.map((i) => i.value));
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{title}</p>
      {items.length === 0 && <p className="text-sm text-emerald-300">Todo al día ✓ Sin deuda pendiente.</p>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-semibold">
                {it.label} {it.sub && <span className="font-normal text-slate-400">· {it.sub}</span>}
              </span>
              <span className="shrink-0 font-mono-num text-xs text-amber-200">{fmtCOP(it.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${it.label}: ${fmtCOP(it.value)}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                style={{ width: `${barWidthPct(it.value, max)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Donut({ ok, pend, title }: { ok: number; pend: number; title: string }) {
  const { total, pPend, C, off } = donutGeom(ok, pend);
  const R = DONUT_R;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 84 84" className="h-20 w-20 shrink-0" role="img" aria-label={`${title}: ${pend} pendientes de ${total}, ${pPend} por ciento`}>
        <circle cx={42} cy={42} r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} />
        <circle
          cx={42}
          cy={42}
          r={R}
          fill="none"
          stroke={pend > 0 ? "#F59E0B" : "#22C55E"}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={off}
          transform="rotate(-90 42 42)"
        />
        <text x={42} y={46} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={700} fontFamily="Fira Code, monospace">
          {pPend}%
        </text>
      </svg>
      <div className="text-sm">
        <p className="font-bold">{title}</p>
        <p className="text-slate-300">
          <span className="font-mono-num font-bold text-amber-200">{pend}</span> pendientes ·{" "}
          <span className="font-mono-num font-bold text-emerald-200">{ok}</span> al día
        </p>
        <p className="text-xs text-slate-500">{total} contratos activos</p>
      </div>
    </div>
  );
}
