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

// Hoy en hora de Colombia (America/Bogota), formato YYYY-MM-DD
export const hoyBogota = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const esDomingo = (fecha: string) =>
  new Date(fecha + "T12:00:00").getDay() === 0;

// Fecha calendario real YYYY-MM-DD (rechaza 2026-02-31, que Date.parse acepta)
export const esFechaValida = (f: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(f + "T12:00:00");
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === f;
};

export const uid = () => crypto.randomUUID();
export const nowISO = () => new Date().toISOString();
