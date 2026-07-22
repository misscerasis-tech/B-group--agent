import { checkRuntimeHealth } from "@/lib/runtime-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkRuntimeHealth();

  return Response.json(health, {
    status: health.ok ? 200 : 503,
  });
}
