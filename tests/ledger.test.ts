import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { db } from "@/server/db";
import { vehicles, clients, contracts, ledgerDays, payments, omisiones } from "@/server/db/schema";
import { getLedger, summarize } from "@/server/db/ledger";
import { ensureDays } from "@/server/db/ensure";
import { uid, nowISO } from "@/lib/utils";

// Congelan el comportamiento con crédito derivado (saldo corrido).
// deuda = max(0, saldo), credito = max(0, −saldo). Nada se pierde.

const s = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

async function fixture(opts: {
  inicio: string;
  cuotaBase?: number;
  saldoInicial?: number;
  omitirDomingos?: boolean;
}) {
  const k = s();
  const v = "v" + k;
  const c = "c" + k;
  const ct = "ct" + k;
  await db.insert(vehicles).values({
    id: v, placa: "TST-" + k.toUpperCase(), cuotaBase: opts.cuotaBase ?? 17000, activa: 1, createdAt: nowISO(),
  });
  await db.insert(clients).values({ id: c, nombre: "Test", telefono: "399" + k, createdAt: nowISO() });
  await db.insert(contracts).values({
    id: ct, vehicleId: v, clientId: c, fechaInicio: opts.inicio, activo: 1,
    saldoInicial: opts.saldoInicial ?? 0, omitirDomingos: opts.omitirDomingos ? 1 : 0, createdAt: nowISO(),
  });
  return ct;
}

async function pay(contractId: string, fecha: string, monto: number) {
  await db.insert(payments).values({
    id: uid(), contractId, fecha, monto, metodo: "efectivo", createdAt: nowISO(),
  });
}

beforeAll(async () => {
  execSync("node scripts/migrate.mjs", { stdio: "pipe" });
  // Limpia tablas de dominio (conserva users/admin)
  await db.delete(payments);
  await db.delete(ledgerDays);
  await db.delete(omisiones);
  await db.delete(contracts);
  await db.delete(clients);
  await db.delete(vehicles);
});

describe("getLedger (comportamiento actual)", () => {
  it("arranca en saldoInicial", async () => {
    const ct = await fixture({ inicio: "2026-09-28", saldoInicial: 17000 });
    await ensureDays(ct, "2026-09-28");
    const L = await getLedger(ct);
    expect(L).toHaveLength(1);
    expect(L[0].deudaAcumulada).toBe(34000); // 17000 + 17000
  });

  it("domingo exento con omitirDomingos (cuota 0, deuda igual)", async () => {
    // 2026-10-04 fue domingo
    const ct = await fixture({ inicio: "2026-10-03", omitirDomingos: true });
    await ensureDays(ct, "2026-10-05");
    const L = await getLedger(ct);
    expect(L.map((r) => r.fecha)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
    const dom = L.find((r) => r.fecha === "2026-10-04")!;
    expect(dom.exento).toBe(true);
    expect(dom.cuotaDia).toBe(0);
    expect(L[2].deudaAcumulada).toBe(34000); // 17k + 0 + 17k
  });

  it("omisión de taller genera exento y no sube la deuda", async () => {
    const ct = await fixture({ inicio: "2026-09-28" });
    await db.insert(omisiones).values({
      id: uid(), contractId: ct, fecha: "2026-09-30", motivo: "Taller", createdAt: nowISO(),
    });
    await ensureDays(ct, "2026-10-01");
    const L = await getLedger(ct);
    const omi = L.find((r) => r.fecha === "2026-09-30")!;
    expect(omi.exento).toBe(true);
    expect(omi.motivo).toBe("Taller");
    expect(L[L.length - 1].deudaAcumulada).toBe(51000); // 3 días normales × 17k
  });

  it("ordena por fecha aunque el día retroactivo se cree después", async () => {
    const ct = await fixture({ inicio: "2026-09-28" });
    await ensureDays(ct, "2026-10-02");
    // simula día retroactivo corregido: se reingresa con diaSeq mayor y fecha menor
    const { eq, and } = await import("drizzle-orm");
    await db
      .delete(ledgerDays)
      .where(and(eq(ledgerDays.contractId, ct), eq(ledgerDays.fecha, "2026-09-29")));
    await db.insert(ledgerDays).values({
      id: uid(), contractId: ct, diaSeq: 999, fecha: "2026-09-29",
      cuotaDia: 17000, exento: 0, createdAt: nowISO(),
    });
    const L = await getLedger(ct);
    expect(L.map((r) => r.fecha)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02",
    ]);
  });

  it("sobrepago genera saldo a favor (derivado, nada se pierde)", async () => {
    const ct = await fixture({ inicio: "2026-10-05" });
    await ensureDays(ct, "2026-10-05");
    await pay(ct, "2026-10-05", 50000);
    const L = await getLedger(ct);
    expect(L[0].deudaAcumulada).toBe(0);
    expect(L[0].credito).toBe(33000); // 50000 − 17000
  });

  it("el crédito cubre días siguientes y sobrevive exentos", async () => {
    const ct = await fixture({ inicio: "2026-10-03", omitirDomingos: true });
    await ensureDays(ct, "2026-10-03");
    await pay(ct, "2026-10-03", 50000); // 17k cuota → 33k crédito
    await ensureDays(ct, "2026-10-06"); // 04 dom exento, 05 y 06 normales
    const L = await getLedger(ct);
    const porFecha = Object.fromEntries(L.map((r) => [r.fecha, r]));
    expect(porFecha["2026-10-04"].exento).toBe(true);
    expect(porFecha["2026-10-05"].creditoUsado).toBe(17000);
    // 03: −33000 · 04 exento conserva · 05: −16000 · 06: −16000+17000 = +1000
    expect(porFecha["2026-10-06"].deudaAcumulada).toBe(1000);
    expect(porFecha["2026-10-06"].credito).toBe(0);
  });

  it("cambio de mes: recaudo por prefijo", async () => {
    const ct = await fixture({ inicio: "2026-09-30" });
    await ensureDays(ct, "2026-10-01");
    await pay(ct, "2026-09-30", 17000);
    await pay(ct, "2026-10-01", 10000);
    const L = await getLedger(ct);
    const sum = summarize(L);
    expect(sum.recaudoMes("2026-09")).toBe(17000);
    expect(sum.recaudoMes("2026-10")).toBe(10000);
  });
});

describe("ensureDays", () => {
  it("es idempotente y rellena huecos", async () => {
    const ct = await fixture({ inicio: "2026-09-28" });
    expect(await ensureDays(ct, "2026-10-02")).toBe(5);
    expect(await ensureDays(ct, "2026-10-02")).toBe(0);
    expect(await ensureDays(ct, "2026-10-05")).toBe(3);
    expect((await getLedger(ct)).map((r) => r.fecha)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30",
      "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05",
    ]);
  });
});
