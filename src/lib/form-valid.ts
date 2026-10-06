/** Validaciones de formularios (réplica exacta de Forms.tsx). */

export function isValidMoto(placa: string, cuota: string): boolean {
  return placa.trim().length >= 4 && Number(cuota) > 0;
}

export function isValidCliente(nombre: string, tel: string): boolean {
  return nombre.trim().length >= 3 && /^[0-9+ ]{7,15}$/.test(tel.trim());
}

export function isValidUsuario(tel: string, pass: string, rol: string, link: string): boolean {
  return tel.trim().length >= 5 && pass.length >= 4 && (rol !== "conductor" || link !== "");
}

/** Motos sin contrato activo (wizard paso 1). */
export function motosLibres<V extends { id: string }, C extends { vehicleId: string; activo: number }>(
  vehs: V[],
  cts: C[],
): V[] {
  return vehs.filter((v) => !cts.some((c) => c.vehicleId === v.id && c.activo === 1));
}

/** ¿Puede el wizard avanzar desde este paso? (1 exige moto, 2 cliente, 3 ambos). */
export function puedeAvanzarWizard(step: number, vehSel: string, cliSel: string): boolean {
  if (step === 1) return vehSel !== "";
  if (step === 2) return cliSel !== "";
  return vehSel !== "" && cliSel !== "";
}

/** Payload del AjusteModal: saldo solo si se escribió + alternancia de domingos. */
export function ajustePayload(
  contractId: string,
  saldo: string,
  omitirDomingosActual: number,
): { contractId: string; saldoInicial?: number; omitirDomingos: number } {
  const body: { contractId: string; saldoInicial?: number; omitirDomingos: number } = {
    contractId,
    omitirDomingos: omitirDomingosActual === 1 ? 0 : 1,
  };
  if (saldo !== "") body.saldoInicial = Number(saldo);
  return body;
}
