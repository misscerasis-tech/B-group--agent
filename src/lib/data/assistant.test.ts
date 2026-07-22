import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateStarterPlan } from "./assistant";

const mocks = vi.hoisted(() => {
  const tx = {
    projectStrategy: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    contentPlanItem: {
      count: vi.fn(),
      create: vi.fn(),
    },
    contentPackage: {
      create: vi.fn(),
    },
    contentPackageFile: {
      createMany: vi.fn(),
    },
    reminder: {
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

describe("generateStarterPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.projectStrategy.findFirst.mockResolvedValue({
      id: "strategy-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      version: 1,
      status: "CONFIRMED",
      targetMarkets: ["巴西"],
      audiences: ["礼品购买者"],
      channels: ["TikTok", "Instagram"],
      contentDirections: ["世界杯", "通勤"],
      packageFrequency: "WEEKLY",
      positioning: "面向礼品购买者",
      rationale: "已确认策略",
      confirmedAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    mocks.tx.contentPlanItem.create.mockResolvedValue({
      id: "plan-1",
    });
    mocks.tx.contentPackage.create.mockResolvedValue({
      id: "package-1",
    });
    mocks.tx.contentPackageFile.createMany.mockResolvedValue({
      count: 11,
    });
    mocks.tx.reminder.create.mockResolvedValue({
      id: "reminder-1",
    });
    mocks.tx.changeLog.create.mockResolvedValue({
      id: "log-1",
    });
  });

  it("creates first-month plan items, a content package, files, reminder and change log", async () => {
    mocks.tx.contentPlanItem.count.mockResolvedValue(0);

    const result = await generateStarterPlan({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result.created).toBe(true);
    expect(mocks.tx.contentPlanItem.create).toHaveBeenCalledTimes(4);
    expect(mocks.tx.contentPlanItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        strategyId: "strategy-1",
        week: 1,
        channel: "TikTok",
        status: "READY",
      }),
    });
    expect(mocks.tx.contentPackage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        strategyId: "strategy-1",
        frequency: "WEEKLY",
        status: "DRAFT",
      }),
    });
    const packageFiles = mocks.tx.contentPackageFile.createMany.mock.calls[0][0].data;
    expect(packageFiles).toHaveLength(11);
    expect(packageFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "海报文案 DOCX",
          status: "PLANNED",
        }),
        expect.objectContaining({
          name: "品牌与合规检查 PDF",
          status: "PLANNED",
        }),
      ]),
    );
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        severity: "WARNING",
        status: "OPEN",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        action: "starter_plan_generated",
        actorUserId: "user-1",
      }),
    });
  });

  it("does not duplicate a starter plan when the project already has plan items", async () => {
    mocks.tx.contentPlanItem.count.mockResolvedValue(1);

    const result = await generateStarterPlan({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result.created).toBe(false);
    expect(mocks.tx.contentPlanItem.create).not.toHaveBeenCalled();
    expect(mocks.tx.contentPackage.create).not.toHaveBeenCalled();
    expect(mocks.tx.contentPackageFile.createMany).not.toHaveBeenCalled();
  });
});
