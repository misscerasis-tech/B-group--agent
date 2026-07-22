import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      ok: true,
      app: "ai-content-growth-agent",
      service: "b-agent",
      database: "ok",
      checkedAt,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        app: "ai-content-growth-agent",
        service: "b-agent",
        database: "unavailable",
        error: error instanceof Error ? error.message : "Unknown database error",
        checkedAt,
      },
      {
        status: 503,
      },
    );
  }
}
