import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(v) + " COP";

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);
export const nowISO = () => new Date().toISOString();
