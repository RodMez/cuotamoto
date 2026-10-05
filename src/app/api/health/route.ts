export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ ok: true, app: "CuotaMoto", ts: new Date().toISOString() });
}
