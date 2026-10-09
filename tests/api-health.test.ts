import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("retorna ok: true, app: CuotaMoto y timestamp ISO válido", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.app).toBe("CuotaMoto");
    expect(typeof json.ts).toBe("string");
    expect(Number.isNaN(Date.parse(json.ts))).toBe(false);
  });
});
