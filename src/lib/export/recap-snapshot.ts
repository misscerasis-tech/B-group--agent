import { prisma } from "@/lib/prisma";
import { getWorkspaceRecapSummary } from "@/lib/data/recaps";

export type WorkspaceRecapExportData = NonNullable<
  Awaited<ReturnType<typeof getWorkspaceRecapExportData>>
>;

export async function getWorkspaceRecapExportData(workspaceId: string) {
  const [workspace, recap] = await Promise.all([
    prisma.workspace.findFirst({
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
    }),
    getWorkspaceRecapSummary(workspaceId),
  ]);

  if (!workspace) {
    return null;
  }

  return {
    workspace,
    recap,
  };
}

export function buildWorkspaceRecapSnapshotJson(
  data: WorkspaceRecapExportData,
  exportedAt = new Date(),
) {
  const { recap, workspace } = data;

  return JSON.stringify(
    {
      schemaVersion: "b-agent-workspace-recap.v1",
      exportedAt: exportedAt.toISOString(),
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      metrics: {
        ...recap.metrics,
        spendYuan: centsToYuan(recap.metrics.spendCents),
        costPerConversionYuan: centsToYuan(recap.metrics.costPerConversionCents),
      },
      readiness: buildReadinessSignals(recap),
      suggestions: recap.suggestions,
      projects: recap.projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
      recentMetrics: recap.recentMetrics.map((metric) => ({
        id: metric.id,
        projectId: metric.projectId,
        projectName: metric.project.name,
        period: metric.period,
        channel: metric.channel,
        impressions: metric.impressions,
        clicks: metric.clicks,
        conversions: metric.conversions,
        spendCents: metric.spendCents,
        spendYuan: centsToYuan(metric.spendCents),
        notes: metric.notes,
        capturedAt: metric.capturedAt,
      })),
      recentChangeLogs: recap.recentChangeLogs.map((log) => ({
        id: log.id,
        projectId: log.projectId,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        summary: log.summary,
        createdAt: log.createdAt,
      })),
    },
    null,
    2,
  );
}

function buildReadinessSignals(recap: Awaited<ReturnType<typeof getWorkspaceRecapSummary>>) {
  return {
    strategyReady: recap.metrics.confirmedStrategies > 0 && recap.metrics.draftStrategies === 0,
    packageReady: recap.metrics.approvedPackages > 0,
    assetsReady: recap.metrics.approvedAssets > 0 && recap.metrics.pendingAssets === 0,
    needsHumanConfirmation:
      recap.metrics.pendingOperations > 0 ||
      recap.metrics.draftStrategies > 0 ||
      recap.metrics.pendingAssets > 0,
    hasPerformanceData: recap.metrics.metricSnapshots > 0,
  };
}

function centsToYuan(value: number) {
  return Number((value / 100).toFixed(2));
}
