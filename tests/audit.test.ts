import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import { audit } from "@/server/db/audit";
import { uid } from "@/lib/utils";
import { migrateTestDb } from "./helpers";

// audit() filtra secretos antes de persistir.

function escribir(e: Parameters<typeof audit>[1]) {
  db.transaction((tx) => {
    audit(tx, e);
  });
}

function filas(accion: string) {
  return db.select().from(auditLog).where(eq(auditLog.accion, accion));
}

beforeAll(() => {
  migrateTestDb();
});

describe("audit", () => {
  it("persiste accion/entidad/entidadId con antes/despues en JSON", async () => {
    const entidadId = uid();
    escribir({
      userId: "u-1",
      accion: "test_basico",
      entidad: "payments",
      entidadId,
      antes: { monto: 1 },
      despues: { monto: 2 },
    });
    const rows = await filas("test_basico");
    const mine = rows.filter((r) => r.entidadId === entidadId);
    expect(mine).toHaveLength(1);
    expect(mine[0].userId).toBe("u-1");
    expect(JSON.parse(mine[0].antes!)).toEqual({ monto: 1 });
    expect(JSON.parse(mine[0].despues!)).toEqual({ monto: 2 });
  });

  it("jamás guarda passwordHash/password (ni anidados)", async () => {
    const entidadId = uid();
    const secreto = "hash-super-secreto";
    escribir({
      userId: null,
      accion: "test_secretos",
      entidad: "users",
      entidadId,
      antes: { passwordHash: secreto, nested: { password: secreto } },
      despues: { password_hash: secreto, nombre: "Ana" },
    });
    const mine = (await filas("test_secretos")).filter((r) => r.entidadId === entidadId);
    expect(mine).toHaveLength(1);
    const crudo = `${mine[0].antes} ${mine[0].despues}`;
    expect(crudo).not.toContain(secreto);
    expect(crudo).toContain("[omitido]");
    expect(JSON.parse(mine[0].despues!).nombre).toBe("Ana");
  });

  it("undefined serializa a null y lo no serializable queda marcado", async () => {
    const entidadId = uid();
    escribir({
      userId: null,
      accion: "test_bordes",
      entidad: "x",
      entidadId,
      antes: undefined,
      despues: { v: BigInt(10) as unknown as number },
    });
    const mine = (await filas("test_bordes")).filter((r) => r.entidadId === entidadId);
    expect(mine).toHaveLength(1);
    expect(mine[0].antes).toBeNull();
    expect(mine[0].despues).toBe("[no serializable]");
  });
});
