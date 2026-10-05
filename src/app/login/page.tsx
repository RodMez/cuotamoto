"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [identificador, setIdent] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr] = useState("");
  const r = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await signIn("credentials", {
      identificador,
      password,
      redirect: false,
    });
    if (res?.error) setErr("Credenciales inválidas");
    else r.push("/");
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <form onSubmit={submit} className="card p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">CuotaMoto</h1>
        <p className="text-sm text-slate-300">Email o teléfono + contraseña</p>
        <input className="input" placeholder="admin@cuotamoto.local / 300..." value={identificador} onChange={(e) => setIdent(e.target.value)} />
        <input className="input" type="password" placeholder="••••••" value={password} onChange={(e) => setPass(e.target.value)} />
        {err && <p className="text-sm text-red-300">{err}</p>}
        <button className="btn btn-primary w-full">Entrar</button>
        <p className="text-xs text-slate-400">Seed: admin@cuotamoto.local / admin123</p>
      </form>
    </div>
  );
}
