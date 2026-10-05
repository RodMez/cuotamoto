"use client";
import { fmtCOP } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: "blue" | "amber" | "green" | "red";
  loading?: boolean;
}) {
  const bar =
    accent === "amber"
      ? "bg-amber-500"
      : accent === "green"
        ? "bg-emerald-500"
        : accent === "red"
          ? "bg-red-500"
          : "bg-blue-500";
  if (loading) {
    return (
      <div className="card card-pad space-y-2">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-7 w-32" />
        <div className="skeleton h-3 w-20" />
      </div>
    );
  }
  return (
    <div className="card card-pad relative overflow-hidden">
      <div className={`absolute left-0 top-0 h-full w-1 ${bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="field-label truncate">{label}</p>
          <p className="font-mono-num truncate text-xl font-bold md:text-2xl">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200" aria-hidden>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function fmtCOPShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export function Bullet({
  label,
  value,
  target,
  format,
}: {
  label: string;
  value: number;
  target: number;
  format?: (v: number) => string;
}) {
  const f = format ?? fmtCOP;
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-mono-num text-xs text-slate-300">
          {f(value)} / {f(target)} · {pct}%
        </span>
      </div>
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={`${label}: ${f(value)} de ${f(target)}, ${pct} por ciento`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-amber-500" style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-[-2px] w-[3px] bg-white" style={{ left: "100%" }} aria-hidden />
      </div>
    </div>
  );
}
