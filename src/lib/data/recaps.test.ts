import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMetricsSnapshots } from "./recaps";

const mocks = vi.hoisted(() => {
  const tx = {
    project: {
      findFirst: vi.fn(),
    },
    metricsSnapshot: {
      create: vi.fn(),
    },
    changeLog: {
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn((callback) => callback(tx)),
    },
    tx,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

describe("createMetricsSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.project.findFirst.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "巴西新品首月增长",
    });
    mocks.tx.metricsSnapshot.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `metric-${data.channel}`,
        ...data,
      }),
    );
    mocks.tx.changeLog.create.mockResolvedValue({
      id: "log-1",
    });
  });

  it("imports multiple metric rows into the selected workspace project", async () => {
    const result = await createMetricsSnapshots({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      rows: [
        {
          period: "2026-07 第3周",
          channel: "TikTok",
          impressions: 10000,
          clicks: 600,
          conversions: 24,
          spendCents: 123456,
          notes: "首轮数据",
        },
        {
          period: "2026-07 第4周",
          channel: "Instagram",
          impressions: 8000,
          clicks: 240,
          conversions: 8,
          spendCents: 56000,
        },
      ],
    });

    expect(result.count).toBe(2);
    expect(mocks.tx.project.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        id: "project-1",
        deletedAt: null,
      },
    });
    expect(mocks.tx.metricsSnapshot.create).toHaveBeenCalledTimes(2);
    expect(mocks.tx.metricsSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        period: "2026-07 第3周",
        channel: "TikTok",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledTimes(2);
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        action: "metrics_snapshot_imported",
        actorUserId: "user-1",
      }),
    });
  });

  it("rejects rows for projects outside the current workspace", async () => {
    mocks.tx.project.findFirst.mockResolvedValue(null);

    await expect(
      createMetricsSnapshots({
        workspaceId: "workspace-1",
        userId: "user-1",
        projectId: "project-2",
        rows: [
          {
            period: "2026-07 第3周",
            channel: "TikTok",
            impressions: 100,
            clicks: 10,
            conversions: 1,
            spendCents: 2000,
          },
        ],
      }),
    ).rejects.toThrow(/当前 Workspace/);
  });
});
