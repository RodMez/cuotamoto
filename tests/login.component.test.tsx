// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signInMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import LoginPage from "@/app/login/page";

afterEach(() => cleanup());

async function llenarYEnviar(ident: string, pass: string) {
  const user = userEvent.setup();
  render(<LoginPage />);
  await user.type(screen.getByPlaceholderText(/admin@cuotamoto/i), ident);
  await user.type(screen.getByPlaceholderText("••••••"), pass);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    signInMock.mockClear();
    pushMock.mockClear();
  });  it("llama signIn con credenciales sin redirect", async () => {
    signInMock.mockResolvedValue({});
    await llenarYEnviar("admin@cuotamoto.local", "clave123");
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      identificador: "admin@cuotamoto.local",
      password: "clave123",
      redirect: false,
    });
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("muestra error y no navega con credenciales inválidas", async () => {
    signInMock.mockResolvedValue({ error: "CredentialsSignin" });
    await llenarYEnviar("nadie", "mala");
    expect(screen.getByText("Credenciales inválidas")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
