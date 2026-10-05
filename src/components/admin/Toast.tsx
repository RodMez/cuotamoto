"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; kind: "ok" | "err" | "info"; text: string };
const Ctx = createContext<{ push: (kind: Toast["kind"], text: string) => void }>({ push: () => {} });

export const useToast = () => useContext(Ctx);

let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = seq++;
    setItems((p) => [...p, { id, kind, text }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`card card-pad flex items-start gap-2 border text-sm ${
              t.kind === "ok"
                ? "border-emerald-500/40"
                : t.kind === "err"
                  ? "border-red-500/40"
                  : "border-sky-500/30"
            }`}
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                t.kind === "ok" ? "bg-emerald-400" : t.kind === "err" ? "bg-red-400" : "bg-sky-400"
              }`}
            />
            <p className="leading-snug">{t.text}</p>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
