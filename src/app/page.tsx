import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  if ((s.user as unknown as { rol?: string })?.rol === "conductor") redirect("/mi-cuenta");
  return <DashboardClient />;
}
