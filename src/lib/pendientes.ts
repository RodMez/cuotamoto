/** Fila mínima para calcular los días pendientes de un contrato. */
export type FilaDiasPendientes = {
  cuotaDia: number;
  deudaAcumulada: number;
};

/**
 * Días pendientes reales: cuotas diarias que faltan para cubrir la deuda
 * del último día del ledger.
 *
 * Recibe las filas en orden cronológico ascendente. Recorre desde el final
 * restando la cuota de cada día hasta cubrir la deuda; los días exentos
 * (cuota 0) no cuentan. Si no hay deuda o hay crédito a favor devuelve 0.
 *
 * Ejemplo: 10 días de 17.000 con un pago de 17.000 el último día → debe
 * 153.000 → 9 días, no 10. Si el pago cubrió todo → 0, aunque las filas
 * antiguas sigan marcadas históricamente como "Pendiente".
 */
export function contarDiasPendientes(ledger: readonly FilaDiasPendientes[]): number {
  let restante = ledger[ledger.length - 1]?.deudaAcumulada ?? 0;
  if (restante <= 0) return 0;

  let dias = 0;
  for (let i = ledger.length - 1; i >= 0 && restante > 0; i--) {
    const cuota = ledger[i].cuotaDia;
    if (cuota <= 0) continue;
    restante -= cuota;
    dias += 1;
  }
  return dias;
}
