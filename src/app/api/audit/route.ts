import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { auditLog, users } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/audit?limit=200 (solo admin). Incluye el nombre del usuario
// que hizo cada acción (respaldo al id si el usuario ya no existe).
export async function GET(req: Request) {
  try {
    await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 200, 1), 1000);
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(limit);
  const todos = await db.select({ id: users.id, name: users.name, telefono: users.telefono }).from(users);
  const nombres = new Map(todos.map((u) => [u.id, u.name ?? u.telefono ?? u.id]));
  return Response.json({
    audit: rows.map((r) => ({
      ...r,
      userName: r.userId ? (nombres.get(r.userId) ?? r.userId) : null,
    })),
  });
}
