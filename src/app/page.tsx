import { identity } from "@/server/authz";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardRoot } from "./dashboard-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const me = await identity();
  if (!me) redirect("/login");
  if (me.rol === "conductor") redirect("/mi-cuenta");
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
          <div className="card p-6 text-center">
            <p className="text-sm text-slate-300">Cargando pagos…</p>
          </div>
        </div>
      }
    >
      <DashboardRoot />
    </Suspense>
  );
}
