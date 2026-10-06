import { auditLog } from "./schema";
import { randomUUID } from "node:crypto";
import type { Tx } from "./ensure";

const SENSIBLES = new Set(["passwordHash", "password", "password_hash"]);

/** JSON sin secretos (passwordHash y claves jamás van al audit). */
function limpio(v: unknown): string | null {
  if (v === undefined) return null;
  try {
    return JSON.stringify(v, (k, val) =>
      SENSIBLES.has(k) ? "[omitido]" : val,
    );
  } catch {
    return "[no serializable]";
  }
}

/**
 * Escribe la fila de audit_log DENTRO de la transacción del cambio.
 * Acepta tx de drizzle (sync) — nunca usar await aquí dentro.
 */
export function audit(
  tx: Tx,
  e: {
    userId: string | null;
    accion: string;
    entidad: string;
    entidadId?: string | null;
    antes?: unknown;
    despues?: unknown;
  },
) {
  tx.insert(auditLog).values({
    id: randomUUID(),
    ts: new Date().toISOString(),
    userId: e.userId,
    accion: e.accion,
    entidad: e.entidad,
    entidadId: e.entidadId ?? null,
    antes: limpio(e.antes),
    despues: limpio(e.despues),
  }).run();
}
