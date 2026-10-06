import { describe, expect, it } from "vitest";
import {
  ajustePayload,
  isValidCliente,
  isValidMoto,
  isValidUsuario,
  motosLibres,
  puedeAvanzarWizard,
} from "@/lib/form-valid";

describe("isValidMoto", () => {
  it("placa ≥4 y cuota >0", () => {
    expect(isValidMoto("PMO-1", "17000")).toBe(true);
    expect(isValidMoto("  PMO-1  ", "17000")).toBe(true);
    expect(isValidMoto("PM", "17000")).toBe(false);
    expect(isValidMoto("", "17000")).toBe(false);
    expect(isValidMoto("PMO-1", "0")).toBe(false);
    expect(isValidMoto("PMO-1", "-5")).toBe(false);
    expect(isValidMoto("PMO-1", "abc")).toBe(false);
    expect(isValidMoto("PMO-1", "")).toBe(false);
  });
});

describe("isValidCliente", () => {
  it("nombre ≥3 y teléfono 7–15 dígitos/+ /espacio", () => {
    expect(isValidCliente("Juan", "3001234567")).toBe(true);
    expect(isValidCliente("  Ana  ", "  3001234  ")).toBe(true);
    expect(isValidCliente("Jo", "3001234567")).toBe(false);
    expect(isValidCliente("Juan", "123")).toBe(false);
    expect(isValidCliente("Juan", "300-1234")).toBe(false);
  });
});

describe("isValidUsuario", () => {
  it("tel ≥5, pass ≥4 y link solo exigido a conductor", () => {
    expect(isValidUsuario("30011", "1234", "cobrador", "")).toBe(true);
    expect(isValidUsuario("30011", "1234", "conductor", "")).toBe(false);
    expect(isValidUsuario("30011", "1234", "conductor", "ct1")).toBe(true);
    expect(isValidUsuario("123", "1234", "cobrador", "")).toBe(false);
    expect(isValidUsuario("30011", "123", "cobrador", "")).toBe(false);
  });
});

describe("motosLibres", () => {
  it("excluye motos con contrato activo (inactivo sí cuenta como libre)", () => {
    const vehs = [{ id: "v1" }, { id: "v2" }, { id: "v3" }];
    const cts = [
      { vehicleId: "v1", activo: 1 },
      { vehicleId: "v2", activo: 0 },
    ];
    expect(motosLibres(vehs, cts).map((v) => v.id)).toEqual(["v2", "v3"]);
  });
});

describe("puedeAvanzarWizard", () => {
  it("paso 1 exige moto, paso 2 cliente, paso 3 ambos", () => {
    expect(puedeAvanzarWizard(1, "", "")).toBe(false);
    expect(puedeAvanzarWizard(1, "v1", "")).toBe(true);
    expect(puedeAvanzarWizard(2, "v1", "")).toBe(false);
    expect(puedeAvanzarWizard(2, "v1", "c1")).toBe(true);
    expect(puedeAvanzarWizard(3, "v1", "")).toBe(false);
    expect(puedeAvanzarWizard(3, "v1", "c1")).toBe(true);
  });
});

describe("ajustePayload", () => {
  it("alterna domingos y manda saldo solo si se escribió", () => {
    expect(ajustePayload("ct1", "5000", 0)).toEqual({
      contractId: "ct1",
      saldoInicial: 5000,
      omitirDomingos: 1,
    });
    expect(ajustePayload("ct1", "", 1)).toEqual({ contractId: "ct1", omitirDomingos: 0 });
  });
});
