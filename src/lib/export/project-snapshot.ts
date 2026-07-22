import { prisma } from "@/lib/prisma";
import { scopedWhere } from "@/lib/workspace-scope";

export type ProjectSnapshotExportData = NonNullable<
  Awaited<ReturnType<typeof getProjectSnapshotExportData>>
>;

export async function getProjectSnapshotExportData(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: scopedWhere(workspaceId, {
      id: projectId,
      deletedAt: null,
    }),
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      projectProducts: {
        include: {
          product: {
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
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      strategies: {
        where: {
          status: {
            not: "ARCHIVED",
          },
        },
        orderBy: [
          {
            version: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
      },
      contentPlanItems: {
        orderBy: [
          {
            week: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
      contentPackages: {
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
      },
      reminders: {
        orderBy: [
          {
            status: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      },
      reviewTasks: {
        orderBy: [
          {
            status: "asc",
          },
          {
            updatedAt: "desc",
          },
        ],
      },
      operations: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
      changeLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      },
    },
  });

  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }

  return project;
}

export function buildProjectSnapshotJson(
  data: ProjectSnapshotExportData,
  exportedAt = new Date(),
) {
  const latestStrategy = data.strategies[0] ?? null;

  return JSON.stringify(
    {
      schemaVersion: "b-agent-project-snapshot.v1",
      exportedAt: exportedAt.toISOString(),
      workspace: data.workspace,
      project: {
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
      products: data.projectProducts.map(({ product }) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        status: product.status,
        facts: product.facts.map((fact) => ({
          id: fact.id,
          label: fact.label,
          value: fact.value,
          source: fact.source,
          status: fact.status,
          confidence: fact.confidence,
        })),
        assets: product.assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          kind: asset.kind,
          source: asset.source,
          status: asset.status,
          originalFilename: asset.originalFilename,
          checksum: asset.checksum,
          metadata: asset.metadata,
        })),
      })),
      latestStrategy: latestStrategy
        ? {
            id: latestStrategy.id,
            version: latestStrategy.version,
            status: latestStrategy.status,
            targetMarkets: latestStrategy.targetMarkets,
            audiences: latestStrategy.audiences,
            channels: latestStrategy.channels,
            contentDirections: latestStrategy.contentDirections,
            packageFrequency: latestStrategy.packageFrequency,
            positioning: latestStrategy.positioning,
            rationale: latestStrategy.rationale,
            confirmedAt: latestStrategy.confirmedAt,
          }
        : null,
      strategyHistory: data.strategies.map((strategy) => ({
        id: strategy.id,
        version: strategy.version,
        status: strategy.status,
        targetMarkets: strategy.targetMarkets,
        channels: strategy.channels,
        packageFrequency: strategy.packageFrequency,
        confirmedAt: strategy.confirmedAt,
      })),
      planItems: data.contentPlanItems.map((item) => ({
        id: item.id,
        week: item.week,
        channel: item.channel,
        theme: item.theme,
        title: item.title,
        deliverable: item.deliverable,
        status: item.status,
      })),
      contentPackages: data.contentPackages.map((contentPackage) => ({
        id: contentPackage.id,
        name: contentPackage.name,
        period: contentPackage.period,
        frequency: contentPackage.frequency,
        status: contentPackage.status,
        summary: contentPackage.summary,
        files: contentPackage.files.map((file) => ({
          id: file.id,
          name: file.name,
          fileType: file.fileType,
          status: file.status,
          assetId: file.assetId,
        })),
      })),
      reminders: data.reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        description: reminder.description,
        severity: reminder.severity,
        status: reminder.status,
        dueAt: reminder.dueAt,
      })),
      reviewTasks: data.reviewTasks.map((review) => ({
        id: review.id,
        subjectType: review.subjectType,
        subjectId: review.subjectId,
        title: review.title,
        description: review.description,
        status: review.status,
        decisionNote: review.decisionNote,
        decidedAt: review.decidedAt,
      })),
      recentAgentOperations: data.operations.map((operation) => ({
        id: operation.id,
        rawText: operation.rawText,
        summary: operation.summary,
        operations: operation.operations,
        conflictCheck: operation.conflictCheck,
        status: operation.status,
        createdAt: operation.createdAt,
      })),
      changeLogs: data.changeLogs.map((log) => ({
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        summary: log.summary,
        before: log.before,
        after: log.after,
        createdAt: log.createdAt,
      })),
    },
    null,
    2,
  );
}
