import { identity } from "@/server/authz";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const me = await identity();
  if (!me) redirect("/login");
  if (me.rol === "conductor") redirect("/mi-cuenta");
  return <DashboardClient />;
}
