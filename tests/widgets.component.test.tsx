// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Confirm, Empty, Field, Modal, SkeletonRows } from "@/components/admin/ui";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import { AreaTrend, Donut, Spark, TopBars } from "@/components/admin/Charts";
import { Bullet, KpiCard } from "@/components/admin/Kpi";

afterEach(() => cleanup());

describe("Modal / Confirm / Empty / Field", () => {
  it("dialog con título, cierra por ✕ y por backdrop (no por contenido)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Ajuste" onClose={onClose}>
        <p>cuerpo</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Ajuste" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await user.click(screen.getByText("cuerpo"));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Confirm con busy deshabilita y cambia etiqueta", () => {
    const { rerender } = render(
      <Confirm title="¿Borrar?" text="seguro" confirmLabel="Sí, borrar" onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Sí, borrar" })).toBeEnabled();
    rerender(
      <Confirm title="¿Borrar?" text="seguro" confirmLabel="Sí, borrar" onCancel={() => {}} onConfirm={() => {}} busy />,
    );
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("Empty y Field muestran título, hint y acción", () => {
    render(
      <Empty title="Sin datos" hint="crea uno" action={<button>ir</button>} />,
    );
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.getByText("crea uno")).toBeInTheDocument();
    render(
      <Field label="Nombre" hint="requerido">
        <input />
      </Field>,
    );
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("requerido")).toBeInTheDocument();
  });

  it("SkeletonRows es aria-hidden", () => {
    const { container } = render(<SkeletonRows n={3} />);
    const hidden = container.firstElementChild!;
    expect(hidden).toHaveAttribute("aria-hidden", "true");
    expect(hidden.querySelectorAll(".skeleton")).toHaveLength(3);
  });
});

describe("Toast", () => {
  function Harness() {
    const { push } = useToast();
    return <button onClick={() => push("ok", "guardado")}>avisar</button>;
  }

  it("push muestra el texto en región aria-live", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "avisar" }));
    expect(screen.getByText("guardado")).toBeInTheDocument();
  });

  it("el toast se auto-descarta a los 3800ms", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Harness />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "avisar" }));
      expect(screen.getByText("guardado")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3800);
      });
      expect(screen.queryByText("guardado")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Charts", () => {
  it("Spark con aria-label de valores", () => {
    render(<Spark values={[1, 2, 3]} />);
    expect(screen.getByRole("img", { name: "Tendencia: 1, 2, 3" })).toBeInTheDocument();
  });

  it("AreaTrend sin datos muestra fallback pero conserva tabla sr-only", () => {
    render(<AreaTrend data={[{ fecha: "2026-10-01", deuda: 0, recaudo: 5000 }]} title="Recaudo" />);
    expect(screen.getByText(/no hay suficientes días/i)).toBeInTheDocument();
    expect(screen.getByText("2026-10-01")).toBeInTheDocument(); // tabla sr-only
  });

  it("AreaTrend con datos grafica con título accesible", () => {
    render(
      <AreaTrend
        title="Recaudo"
        data={[
          { fecha: "2026-10-01", deuda: 0, recaudo: 5000 },
          { fecha: "2026-10-02", deuda: 0, recaudo: 9000 },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: /Recaudo\. Valores: 5000, 9000/ })).toBeInTheDocument();
    expect(screen.getByText(/máx .* · 2 días/)).toBeInTheDocument();
  });

  it("TopBars vacío celebra y con items etiqueta cada barra", () => {
    const { rerender } = render(<TopBars items={[]} title="Top" />);
    expect(screen.getByText(/todo al día/i)).toBeInTheDocument();
    rerender(
      <TopBars items={[{ label: "PMO-1", sub: "Ana", value: 34000 }]} title="Top" />,
    );
    expect(screen.getByRole("img", { name: /PMO-1/ })).toBeInTheDocument();
  });

  it("Donut anuncia pendientes y porcentaje", () => {
    render(<Donut ok={3} pend={1} title="Flota" />);
    expect(
      screen.getByRole("img", { name: "Flota: 1 pendientes de 4, 25 por ciento" }),
    ).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});

describe("Kpi", () => {
  it("KpiCard loading esqueleto vs contenido", () => {
    const { rerender } = render(
      <KpiCard label="Deuda" value="$1" icon={<span>i</span>} loading />,
    );
    expect(screen.queryByText("Deuda")).not.toBeInTheDocument();
    rerender(<KpiCard label="Deuda" value="$1" sub="3 motos" icon={<span>i</span>} />);
    expect(screen.getByText("Deuda")).toBeInTheDocument();
    expect(screen.getByText("$1")).toBeInTheDocument();
    expect(screen.getByText("3 motos")).toBeInTheDocument();
  });

  it("Bullet anuncia valor/meta/porcentaje", () => {
    render(<Bullet label="Meta" value={150} target={100} />);
    expect(
      screen.getByRole("img", { name: /Meta: .* de .*, 100 por ciento/ }),
    ).toBeInTheDocument();
  });
});
