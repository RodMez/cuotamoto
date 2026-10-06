import { requireRole } from "@/server/authz";
import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/audit?limit=200 (solo admin)
export async function GET(req: Request) {
  try {
    await requireRole("admin");
  } catch (res) {
    return res as Response;
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 200, 1), 1000);
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(limit);
  return Response.json({ audit: rows });
}
