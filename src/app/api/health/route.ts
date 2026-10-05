export const runtime = "nodejs";
export async function GET() {
  return Response.json({ ok: true, app: "CuotaMoto", ts: new Date().toISOString() });
}
