"use client";
import type { ReactNode } from "react";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`card card-pad w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto scroll-thin space-y-3`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">{title}</h2>
          <button className="btn btn-ghost !min-h-[36px] !px-3 text-sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, text, confirmLabel, onCancel, onConfirm, busy }: { title: string; text: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; busy?: boolean }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-300">{text}</p>
      <div className="flex gap-2 pt-1">
        <button className="btn btn-danger flex-1" disabled={busy} onClick={onConfirm}>
          {busy ? "Procesando…" : confirmLabel}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </Modal>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
      <p className="font-bold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-400">{hint}</p>}
      {action}
    </div>
  );
}

export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2 p-2" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton h-10 w-full" />
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
