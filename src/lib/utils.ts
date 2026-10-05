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

export const esFechaValida = (f: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));
export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);
export const nowISO = () => new Date().toISOString();
