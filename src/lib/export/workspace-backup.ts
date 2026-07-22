import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type WorkspaceBackupExportData = NonNullable<
  Awaited<ReturnType<typeof getWorkspaceBackupExportData>>
>;

const SENSITIVE_KEY_PATTERN = /(secret|token|password|api_?key|credential|tenant_?key)/i;
export const WORKSPACE_BACKUP_SCHEMA_VERSION = "b-agent-workspace-backup.v1";

export async function getWorkspaceBackupExportData(workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!workspace) {
    return null;
  }

  const [
    members,
    projects,
    products,
    projectStrategies,
    contentPlanItems,
    contentPackages,
    reviewTasks,
    reminders,
    metricsSnapshots,
    conversations,
    agentOperations,
    changeLogs,
    assets,
    imageProviderConfigs,
    imageGenerationJobs,
    integrationConnections,
    integrationMigrationRecords,
  ] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.project.findMany({
      where: scopedWhere(workspaceId),
      include: {
        projectProducts: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.product.findMany({
      where: scopedWhere(workspaceId),
      include: {
        facts: {
          orderBy: {
            createdAt: "asc",
          },
        },
        assets: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.projectStrategy.findMany({
      where: scopedWhere(workspaceId),
      orderBy: [
        {
          projectId: "asc",
        },
        {
          version: "desc",
        },
      ],
    }),
    prisma.contentPlanItem.findMany({
      where: scopedWhere(workspaceId),
      orderBy: [
        {
          projectId: "asc",
        },
        {
          week: "asc",
        },
      ],
    }),
    prisma.contentPackage.findMany({
      where: scopedWhere(workspaceId),
      include: {
        files: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.reviewTask.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.reminder.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.metricsSnapshot.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        capturedAt: "desc",
      },
    }),
    prisma.agentConversation.findMany({
      where: scopedWhere(workspaceId),
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.agentOperation.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.changeLog.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.asset.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.imageGenerationProviderConfig.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.imageGenerationJob.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.integrationConnection.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.integrationMigrationRecord.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    workspace,
    members,
    projects,
    products,
    projectStrategies,
    contentPlanItems,
    contentPackages,
    reviewTasks,
    reminders,
    metricsSnapshots,
    conversations,
    agentOperations,
    changeLogs,
    assets,
    imageProviderConfigs,
    imageGenerationJobs,
    integrationConnections,
    integrationMigrationRecords,
  };
}

export function buildWorkspaceBackupJson(
  data: WorkspaceBackupExportData,
  exportedAt = new Date(),
) {
  return JSON.stringify(
    {
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      safety: {
        includesUploadedFileBytes: false,
        includesSecrets: false,
        note: "此备份仅包含当前 Workspace 的结构化业务数据和文件元数据；真实文件需保留 storage/assets 或对象存储备份。",
      },
      counts: {
        projects: data.projects.length,
        products: data.products.length,
        assets: data.assets.length,
        contentPackages: data.contentPackages.length,
        reminders: data.reminders.length,
        metricsSnapshots: data.metricsSnapshots.length,
        changeLogs: data.changeLogs.length,
      },
      data: redactSensitiveFields(data),
    },
    null,
    2,
  );
}

export function redactSensitiveFields(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSensitiveFields(fieldValue),
    ]),
  );
}
