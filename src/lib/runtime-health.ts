import { prisma } from "@/lib/prisma";

export type RuntimeHealthStatus = "ok" | "warning" | "error";

export type RuntimeHealth = {
  ok: boolean;
  app: string;
  service: string;
  checkedAt: string;
  runtime: {
    nodeVersion: string;
    environment: string;
  };
  environment: {
    databaseUrl: "configured" | "missing";
    aiProvider: string;
    assetStorageDir: "configured" | "default";
  };
  database: {
    status: "ok" | "unavailable";
    message?: string;
  };
  nextSteps: string[];
};

export async function checkRuntimeHealth(): Promise<RuntimeHealth> {
  const checkedAt = new Date().toISOString();
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL);
  let database: RuntimeHealth["database"] = {
    status: "unavailable",
    message: "DATABASE_URL 尚未配置。",
  };

  if (databaseUrlConfigured) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = {
        status: "ok",
      };
    } catch (error) {
      database = {
        status: "unavailable",
        message: error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  return buildRuntimeHealth({
    checkedAt,
    database,
    databaseUrlConfigured,
    nodeVersion: process.version,
    nodeEnvironment: process.env.NODE_ENV ?? "development",
    aiProvider: process.env.AI_PROVIDER ?? "local-rule",
    assetStorageDirConfigured: Boolean(process.env.ASSET_STORAGE_DIR),
  });
}

export function buildRuntimeHealth(input: {
  checkedAt: string;
  database: RuntimeHealth["database"];
  databaseUrlConfigured: boolean;
  nodeVersion: string;
  nodeEnvironment: string;
  aiProvider: string;
  assetStorageDirConfigured: boolean;
}): RuntimeHealth {
  const nextSteps = buildRuntimeHealthNextSteps(input);

  return {
    ok: input.database.status === "ok" && input.databaseUrlConfigured,
    app: "ai-content-growth-agent",
    service: "b-agent",
    checkedAt: input.checkedAt,
    runtime: {
      nodeVersion: input.nodeVersion,
      environment: input.nodeEnvironment,
    },
    environment: {
      databaseUrl: input.databaseUrlConfigured ? "configured" : "missing",
      aiProvider: input.aiProvider,
      assetStorageDir: input.assetStorageDirConfigured ? "configured" : "default",
    },
    database: input.database,
    nextSteps,
  };
}

export function buildRuntimeHealthNextSteps(input: {
  database: RuntimeHealth["database"];
  databaseUrlConfigured: boolean;
  aiProvider: string;
}) {
  const steps: string[] = [];

  if (!input.databaseUrlConfigured) {
    steps.push("复制 .env.example 为 .env，并填写 DATABASE_URL。");
  }

  if (input.databaseUrlConfigured && input.database.status !== "ok") {
    steps.push("确认 PostgreSQL 已启动；本地推荐安装 Docker Desktop 后运行 npx pnpm@10.13.1 run docker:up。");
    steps.push("数据库启动后运行 npx pnpm@10.13.1 run db:migrate 和 npx pnpm@10.13.1 run db:seed。");
  }

  if (input.aiProvider !== "local-rule") {
    steps.push("当前阶段真实 GPT 适配器尚未启用，AI_PROVIDER 会自动降级到 local-rule。");
  }

  if (steps.length === 0) {
    steps.push("运行 npx pnpm@10.13.1 run dev:b 后打开 http://127.0.0.1:3002/b-agent。");
  }

  return steps;
}
