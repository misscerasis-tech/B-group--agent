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
  actorUserId: string,
  input: {
    displayName: string;
    tenantDisplayName?: string;
    notificationTargetName?: string;
    repositoryTargetName?: string;
    notes?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const connection = await tx.integrationConnection.create({
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

    await tx.changeLog.create({
      data: {
        workspaceId,
        entityType: "IntegrationConnection",
        entityId: connection.id,
        action: "integration_placeholder_created",
        summary: `登记飞书占位连接：${connection.displayName}`,
        after: integrationConnectionToJson(connection),
        actorUserId,
      },
    });

    return connection;
  });
}

export async function disableIntegrationConnection(
  workspaceId: string,
  actorUserId: string,
  connectionId: string,
) {
  const connection = await prisma.integrationConnection.findFirst({
    where: scopedWhere(workspaceId, {
      id: connectionId,
    }),
  });

  if (!connection) {
    throw new Error("未找到当前 Workspace 下的集成连接。");
  }

  return prisma.$transaction(async (tx) => {
    const updatedConnection = await tx.integrationConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status: IntegrationStatus.DISABLED,
        disabledAt: new Date(),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        entityType: "IntegrationConnection",
        entityId: connection.id,
        action: "integration_disabled",
        summary: `停用集成连接：${connection.displayName}`,
        before: integrationConnectionToJson(connection),
        after: integrationConnectionToJson(updatedConnection),
        actorUserId,
      },
    });

    return updatedConnection;
  });
}

export async function createIntegrationMigrationRecord(
  workspaceId: string,
  actorUserId: string,
  input: {
    connectionId?: string;
    fromTargetName?: string;
    toTargetName?: string;
    summary: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    if (input.connectionId) {
      const connection = await tx.integrationConnection.findFirst({
        where: scopedWhere(workspaceId, {
          id: input.connectionId,
        }),
      });

      if (!connection) {
        throw new Error("所选集成连接不属于当前 Workspace。");
      }
    }

    const record = await tx.integrationMigrationRecord.create({
      data: {
        workspaceId,
        connectionId: input.connectionId || null,
        provider: IntegrationProvider.FEISHU,
        fromTargetName: input.fromTargetName || null,
        toTargetName: input.toTargetName || null,
        summary: input.summary,
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        entityType: "IntegrationMigrationRecord",
        entityId: record.id,
        action: "integration_migration_record_created",
        summary: `记录飞书迁移：${record.summary}`,
        after: {
          provider: record.provider,
          fromTargetName: record.fromTargetName,
          toTargetName: record.toTargetName,
          summary: record.summary,
        },
        actorUserId,
      },
    });

    return record;
  });
}

export async function testFeishuConnectionPlaceholder(
  workspaceId: string,
  actorUserId: string,
  connectionId: string,
) {
  const connection = await prisma.integrationConnection.findFirst({
    where: scopedWhere(workspaceId, {
      id: connectionId,
    }),
  });

  if (!connection) {
    throw new Error("未找到当前 Workspace 下的集成连接。");
  }

  return prisma.$transaction(async (tx) => {
    const testedAt = new Date();
    const updatedConnection = await tx.integrationConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status:
          connection.status === IntegrationStatus.DISABLED
            ? IntegrationStatus.DISABLED
            : IntegrationStatus.NEEDS_RECONNECT,
        notes: appendConnectionNote(
          connection.notes,
          `占位测试 ${testedAt.toISOString()}：未配置真实授权，核心 Web 业务可独立运行。`,
        ),
      },
    });

    await tx.changeLog.create({
      data: {
        workspaceId,
        entityType: "IntegrationConnection",
        entityId: connection.id,
        action: "integration_connection_tested",
        summary: `测试飞书连接占位：${connection.displayName}`,
        before: integrationConnectionToJson(connection),
        after: integrationConnectionToJson(updatedConnection),
        actorUserId,
      },
    });

    return updatedConnection;
  });
}

function appendConnectionNote(notes: string | null, nextNote: string) {
  return [notes, nextNote].filter(Boolean).join("\n");
}

function integrationConnectionToJson(connection: {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  displayName: string;
  tenantDisplayName: string | null;
  notificationTargetName: string | null;
  repositoryTargetName: string | null;
  notes: string | null;
}) {
  return {
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    displayName: connection.displayName,
    tenantDisplayName: connection.tenantDisplayName,
    notificationTargetName: connection.notificationTargetName,
    repositoryTargetName: connection.repositoryTargetName,
    notes: connection.notes,
  };
}
