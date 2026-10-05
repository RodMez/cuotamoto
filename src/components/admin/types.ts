export type Veh = { id: string; placa: string; alias: string | null; cuotaBase: number; activa?: number };
export type Cli = { id: string; nombre: string; telefono: string; documento?: string | null; userId?: string | null };
export type Ct = {
  id: string;
  vehicleId: string;
  clientId: string;
  fechaInicio: string;
  activo: number;
  saldoInicial: number;
  omitirDomingos: number;
};
export type Omi = { id: string; contractId: string; fecha: string; motivo: string | null };
export type LedgerPago = { id: string; monto: number; metodo: string; nota: string | null };
export type LedgerRow = {
  diaSeq: number;
  fecha: string;
  cuotaDia: number;
  exento: boolean;
  motivo: string | null;
  totalPagado: number;
  deudaAcumulada: number;
  estado: string;
  pagos: LedgerPago[];
};

export type ContractHealth = {
  contractId: string;
  deuda: number;
  diasPend: number;
  diasTotal: number;
  recaudoMes: number;
  alDia: boolean;
};

export type AdminSnapshot = {
  vehs: Veh[];
  clis: Cli[];
  cts: Ct[];
  healthByContract: Record<string, ContractHealth>;
  deudaTotal: number;
  diasPendTotal: number;
  recaudoMesTotal: number;
  motosLibres: Veh[];
  motosOcupadas: Veh[];
  contratosActivos: Ct[];
  topDeudores: { contractId: string; placa: string; cliente: string; deuda: number; diasPend: number }[];
  serieDeuda14d: { fecha: string; deuda: number; recaudo: number }[];
};
