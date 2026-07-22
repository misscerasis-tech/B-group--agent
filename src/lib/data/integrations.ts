import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export async function listWorkspaceIntegrations(workspaceId: string) {
  const [connections, migrationRecords] = await Promise.all([
    prisma.integrationConnection.findMany({
      where: scopedWhere(workspaceId),
      include: {
        migrationRecords: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.integrationMigrationRecord.findMany({
      where: scopedWhere(workspaceId),
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
  ]);

  return {
    connections,
    migrationRecords,
  };
}

export async function createFeishuConnectionPlaceholder(
  workspaceId: string,
  input: {
    displayName: string;
    tenantDisplayName?: string;
    notificationTargetName?: string;
    repositoryTargetName?: string;
    notes?: string;
  },
) {
  return prisma.integrationConnection.create({
    data: {
      workspaceId,
      provider: IntegrationProvider.FEISHU,
      status: IntegrationStatus.NEEDS_RECONNECT,
      displayName: input.displayName,
      tenantDisplayName: input.tenantDisplayName || null,
      notificationTargetName: input.notificationTargetName || null,
      repositoryTargetName: input.repositoryTargetName || null,
      notes:
        input.notes ||
        "本地占位连接：真实授权、密钥、tenant key、chat ID 和 document ID 后续通过安全配置接入。",
    },
  });
}

export async function disableIntegrationConnection(workspaceId: string, connectionId: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: scopedWhere(workspaceId, {
      id: connectionId,
    }),
  });

  if (!connection) {
    throw new Error("未找到当前 Workspace 下的集成连接。");
  }

  return prisma.integrationConnection.update({
    where: {
      id: connection.id,
    },
    data: {
      status: IntegrationStatus.DISABLED,
      disabledAt: new Date(),
    },
  });
}

export async function createIntegrationMigrationRecord(
  workspaceId: string,
  input: {
    connectionId?: string;
    fromTargetName?: string;
    toTargetName?: string;
    summary: string;
  },
) {
  return prisma.integrationMigrationRecord.create({
    data: {
      workspaceId,
      connectionId: input.connectionId || null,
      provider: IntegrationProvider.FEISHU,
      fromTargetName: input.fromTargetName || null,
      toTargetName: input.toTargetName || null,
      summary: input.summary,
    },
  });
}
