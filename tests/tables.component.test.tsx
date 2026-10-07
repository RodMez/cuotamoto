// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientsTable, ContractsTable, FleetTable } from "@/components/admin/Tables";
import type { Cli, ContractHealth, Ct, Veh } from "@/components/admin/types";

afterEach(() => cleanup());

const vehs: Veh[] = [
  { id: "v1", placa: "PMO-002", alias: "Norte", cuotaBase: 17000 },
  { id: "v2", placa: "ABC-999", alias: null, cuotaBase: 25000 },
];

const cts: Ct[] = [
  {
    id: "ct1", vehicleId: "v1", clientId: "c1", fechaInicio: "2026-09-01",
    activo: 1, saldoInicial: 0, omitirDomingos: 0,
  },
];

const health: Record<string, ContractHealth> = {
  ct1: { contractId: "ct1", deuda: 34000, diasPend: 2, diasTotal: 2, recaudoMes: 0, alDia: false },
};

function filasBody() {
  return screen.getAllByRole("row").slice(1);
}

describe("FleetTable", () => {
  it("muestra motos con badge Libre/Ocupada y deuda del health", () => {
    render(<FleetTable vehs={vehs} cts={cts} health={health} loading={false} query="" />);
    expect(screen.getByText("PMO-002")).toBeInTheDocument();
    expect(screen.getByText("Norte")).toBeInTheDocument();
    expect(screen.getByText("Ocupada")).toBeInTheDocument();
    expect(screen.getByText("Libre")).toBeInTheDocument();
    // v2 sin contrato: deuda 0
    const rows = filasBody();
    expect(rows[1].textContent).toContain("ABC-999");
  });

  it("filtra por placa o alias (case-insensitive)", () => {
    const { rerender } = render(
      <FleetTable vehs={vehs} cts={cts} health={health} loading={false} query="" />,
    );
    expect(filasBody()).toHaveLength(2);
    rerender(<FleetTable vehs={vehs} cts={cts} health={health} loading={false} query="pmo" />);
    expect(filasBody()).toHaveLength(1);
    rerender(<FleetTable vehs={vehs} cts={cts} health={health} loading={false} query="NORTE" />);
    expect(filasBody()).toHaveLength(1);
    expect(screen.getByText("PMO-002")).toBeInTheDocument();
  });

  it("ordena por deuda asc/desc al clickear el header", async () => {
    const user = userEvent.setup();
    render(<FleetTable vehs={vehs} cts={cts} health={health} loading={false} query="" />);
    await user.click(screen.getByRole("button", { name: /deuda/i }));
    let rows = filasBody();
    expect(rows[0].textContent).toContain("ABC-999"); // 0 primero
    expect(rows[1].textContent).toContain("PMO-002");
    await user.click(screen.getByRole("button", { name: /deuda/i }));
    rows = filasBody();
    expect(rows[0].textContent).toContain("PMO-002");
  });

  it("ordena por placa", async () => {
    const user = userEvent.setup();
    render(<FleetTable vehs={vehs} cts={cts} health={health} loading={false} query="" />);
    await user.click(screen.getByRole("button", { name: /placa/i }));
    const rows = filasBody();
    expect(rows[0].textContent).toContain("ABC-999");
  });

  it("loading muestra skeleton y vacío muestra Empty", () => {
    const { rerender } = render(
      <FleetTable vehs={[]} cts={[]} health={{}} loading={true} query="" />,
    );
    expect(screen.queryByText("PMO-002")).not.toBeInTheDocument();
    rerender(<FleetTable vehs={[]} cts={[]} health={{}} loading={false} query="" />);
    expect(screen.getByText("Sin motos")).toBeInTheDocument();
  });
});

describe("ClientsTable", () => {
  const letras = "ABCDEFGHIJK".split("");
  const clis: Cli[] = letras.map((l) => ({ id: `c${l}`, nombre: `Cliente ${l}`, telefono: `300${l}` }));
  const conLink: Cli[] = [
    { id: "cA", nombre: "Cliente A", telefono: "300A", userId: "u1" },
    { id: "cB", nombre: "Cliente B", telefono: "300B" },
  ];
  const ccts: Ct[] = [
    { id: "x1", vehicleId: "v1", clientId: "cA", fechaInicio: "2026-09-01", activo: 1, saldoInicial: 0, omitirDomingos: 0 },
    { id: "x2", vehicleId: "v2", clientId: "cA", fechaInicio: "2026-09-01", activo: 0, saldoInicial: 0, omitirDomingos: 0 },
  ];

  it("pagina de 10 en 10 con contador", async () => {
    const user = userEvent.setup();
    render(<ClientsTable clis={clis} cts={[]} loading={false} query="" />);
    expect(screen.getByText("1/2 · 11 conductores")).toBeInTheDocument();
    expect(screen.getByText("Cliente A")).toBeInTheDocument();
    expect(screen.queryByText("Cliente K")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "→" }));
    expect(screen.getByText("2/2 · 11 conductores")).toBeInTheDocument();
    expect(screen.getByText("Cliente K")).toBeInTheDocument();
    expect(screen.queryByText("Cliente A")).not.toBeInTheDocument();
  });

  it("badge Vinculado vs Sin usuario y conteo de contratos", () => {
    render(<ClientsTable clis={conLink} cts={ccts} loading={false} query="" />);
    expect(screen.getByText("✓ Vinculado")).toBeInTheDocument();
    expect(screen.getByText("Sin usuario")).toBeInTheDocument();
    const rowA = screen.getByText("Cliente A").closest("tr")!;
    expect(within(rowA).getByText("2")).toBeInTheDocument(); // 2 contratos
  });

  it("filtra por nombre o teléfono", () => {
    render(<ClientsTable clis={conLink} cts={[]} loading={false} query="cliente b" />);
    expect(screen.queryByText("Cliente A")).not.toBeInTheDocument();
    expect(screen.getByText("Cliente B")).toBeInTheDocument();
  });

  it("vacío muestra Empty", () => {
    render(<ClientsTable clis={[]} cts={[]} loading={false} query="" />);
    expect(screen.getByText("Sin conductores")).toBeInTheDocument();
  });
});

describe("ContractsTable", () => {
  const vehsC: Veh[] = [
    { id: "v1", placa: "PMO-001", alias: null, cuotaBase: 17000 },
    { id: "v2", placa: "PMO-002", alias: null, cuotaBase: 17000 },
    { id: "v3", placa: "PMO-003", alias: null, cuotaBase: 17000 },
  ];
  const clisC: Cli[] = [{ id: "c1", nombre: "Ana", telefono: "300" }];
  const mk = (id: string, vehicleId: string, omitir: number): Ct => ({
    id, vehicleId, clientId: "c1", fechaInicio: "2026-09-01",
    activo: 1, saldoInicial: 0, omitirDomingos: omitir,
  });
  const ctsC = [mk("a", "v1", 0), mk("b", "v2", 1), mk("c", "v3", 0)];
  const healthC: Record<string, ContractHealth> = {
    a: { contractId: "a", deuda: 5000, diasPend: 1, diasTotal: 2, recaudoMes: 0, alDia: false },
    b: { contractId: "b", deuda: 0, diasPend: 0, diasTotal: 1, recaudoMes: 17000, alDia: true },
    c: { contractId: "c", deuda: 20000, diasPend: 2, diasTotal: 2, recaudoMes: 0, alDia: false },
  };
  const base = { cts: ctsC, vehs: vehsC, clis: clisC, health: healthC, loading: false, query: "" };

  it("ordena por deuda desc y filtra pendientes/aldia", () => {
    const { rerender } = render(<ContractsTable {...base} filter="todos" onAjustar={() => {}} />);
    let rows = filasBody();
    expect(rows.map((r) => r.textContent)).toMatchObject([
      expect.stringContaining("PMO-003"), // 20k
      expect.stringContaining("PMO-001"), // 5k
      expect.stringContaining("PMO-002"), // 0
    ]);
    rerender(<ContractsTable {...base} filter="pendientes" onAjustar={() => {}} />);
    expect(filasBody()).toHaveLength(2);
    rerender(<ContractsTable {...base} filter="aldia" onAjustar={() => {}} />);
    rows = filasBody();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("PMO-002");
  });

  it("badges de domingos y estado + callback Ajustar", async () => {
    const user = userEvent.setup();
    const onAjustar = vi.fn();
    render(<ContractsTable {...base} filter="todos" onAjustar={onAjustar} />);
    expect(screen.getByText("Sin domingos")).toBeInTheDocument();
    expect(screen.getAllByText("Con domingos")).toHaveLength(2);
    expect(screen.getByText("✓ Al día")).toBeInTheDocument();
    const btns = screen.getAllByRole("button", { name: "Ajustar" });
    await user.click(btns[0]); // primera fila = mayor deuda (c)
    expect(onAjustar).toHaveBeenCalledWith("c");
  });

  it("filtra por query placa/cliente", () => {
    const { rerender } = render(
      <ContractsTable {...base} filter="todos" query="ana" onAjustar={() => {}} />,
    );
    expect(filasBody()).toHaveLength(3);
    rerender(<ContractsTable {...base} filter="todos" query="PMO-001" onAjustar={() => {}} />);
    expect(filasBody()).toHaveLength(1);
  });
});
