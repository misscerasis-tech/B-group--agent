import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReminderSeverity, ReviewSubjectType, ReviewTaskStatus } from "@prisma/client";
import {
  attachAssetToPackageFile,
  buildMetricsReminderCandidates,
  cancelReviewTask,
  createContentPackage,
  submitContentPackageForReview,
} from "./content-workspace";

const mocks = vi.hoisted(() => {
  const tx = {
    project: {
      findFirst: vi.fn(),
    },
    projectStrategy: {
      findFirst: vi.fn(),
    },
    contentPackage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contentPackageFile: {
      createMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    asset: {
      findFirst: vi.fn(),
    },
    reviewTask: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

describe("cancelReviewTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  });

  it("can limit cancellation to the current project inside the workspace", async () => {
    const reviewTask = {
      id: "review-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      subjectType: ReviewSubjectType.CONTENT_PACKAGE,
      subjectId: "package-1",
      title: "审核素材包：8 月 TikTok 素材包",
      description: "待取消任务",
      status: ReviewTaskStatus.PENDING,
      reviewerUserId: null,
      decisionNote: null,
      dueAt: null,
      decidedAt: null,
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    };
    mocks.tx.reviewTask.findFirst.mockResolvedValue(reviewTask);
    mocks.tx.reviewTask.update.mockResolvedValue({
      ...reviewTask,
      status: ReviewTaskStatus.CANCELED,
      reviewerUserId: "user-1",
      decisionNote: "B 组 Agent 工作台取消审核任务。",
    });
    mocks.tx.changeLog.create.mockResolvedValue({ id: "log-1" });

    await cancelReviewTask({
      workspaceId: "workspace-1",
      userId: "user-1",
      taskId: "review-1",
      projectId: "project-1",
      decisionNote: "B 组 Agent 工作台取消审核任务。",
    });

    expect(mocks.tx.reviewTask.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        id: "review-1",
        projectId: "project-1",
        status: ReviewTaskStatus.PENDING,
      },
    });
    expect(mocks.tx.reviewTask.update).toHaveBeenCalledWith({
      where: {
        id: "review-1",
      },
      data: expect.objectContaining({
        status: ReviewTaskStatus.CANCELED,
        reviewerUserId: "user-1",
      }),
    });
  });
});

describe("createContentPackage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  });

  it("creates a workspace-scoped content package with the V1 default file checklist", async () => {
    mocks.tx.project.findFirst.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "巴西新品上市",
    });
    mocks.tx.projectStrategy.findFirst.mockResolvedValue({
      id: "strategy-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      version: 2,
    });
    mocks.tx.contentPackage.create.mockResolvedValue({
      id: "package-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      strategyId: "strategy-1",
      name: "8 月第 1 周 TikTok 素材包",
      period: "2026-08 第1周",
      frequency: "WEEKLY",
      status: "DRAFT",
    });
    mocks.tx.contentPackageFile.createMany.mockResolvedValue({ count: 11 });
    mocks.tx.changeLog.create.mockResolvedValue({ id: "log-1" });

    const contentPackage = await createContentPackage({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      name: "8 月第 1 周 TikTok 素材包",
      period: "2026-08 第1周",
      frequency: "WEEKLY",
      summary: "巴西 TikTok 首周素材包。",
    });

    expect(contentPackage.id).toBe("package-1");
    expect(mocks.tx.project.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        id: "project-1",
        deletedAt: null,
      },
    });
    expect(mocks.tx.contentPackage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        strategyId: "strategy-1",
        status: "DRAFT",
      }),
    });
    expect(mocks.tx.contentPackageFile.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          name: "海报文案 DOCX",
          fileType: "DOCX",
          status: "PLANNED",
        }),
        expect.objectContaining({
          name: "品牌与合规检查 PDF",
          fileType: "PDF",
          status: "PLANNED",
        }),
        expect.objectContaining({
          name: "最终 ZIP 打包下载",
          fileType: "ZIP",
          status: "PLANNED",
        }),
      ]),
    });
    const createdFiles = mocks.tx.contentPackageFile.createMany.mock.calls[0][0].data;
    expect(createdFiles).toHaveLength(11);
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPackage",
        entityId: "package-1",
        action: "content_package_created",
        actorUserId: "user-1",
      }),
    });
  });

  it("rejects packages for projects outside the current workspace", async () => {
    mocks.tx.project.findFirst.mockResolvedValue(null);

    await expect(
      createContentPackage({
        workspaceId: "workspace-1",
        userId: "user-1",
        projectId: "project-from-another-workspace",
        name: "错误 Workspace 素材包",
        period: "2026-08",
        frequency: "MONTHLY",
      }),
    ).rejects.toThrow("未找到当前 Workspace 下的项目");

    expect(mocks.tx.contentPackage.create).not.toHaveBeenCalled();
    expect(mocks.tx.contentPackageFile.createMany).not.toHaveBeenCalled();
  });
});

describe("buildMetricsReminderCandidates", () => {
  it("creates proactive reminders for weak click and conversion signals", () => {
    const candidates = buildMetricsReminderCandidates([
      {
        projectId: "project-1",
        project: {
          name: "巴西新品首月增长",
        },
        period: "2026-07 第3周",
        channel: "TikTok",
        impressions: 3000,
        clicks: 6,
        conversions: 0,
        spendCents: 12000,
      },
      {
        projectId: "project-2",
        project: {
          name: "日本新品首月增长",
        },
        period: "2026-07 第3周",
        channel: "Instagram",
        impressions: 500,
        clicks: 80,
        conversions: 0,
        spendCents: 0,
      },
    ]);

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "点击率偏低：TikTok 2026-07 第3周",
          severity: ReminderSeverity.WARNING,
        }),
        expect.objectContaining({
          title: "有花费无转化：TikTok 2026-07 第3周",
          severity: ReminderSeverity.WARNING,
        }),
        expect.objectContaining({
          title: "有点击无转化：Instagram 2026-07 第3周",
          severity: ReminderSeverity.WARNING,
        }),
      ]),
    );
  });
});

describe("submitContentPackageForReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  });

  it("marks a package as review needed and creates a pending review task", async () => {
    mocks.tx.contentPackage.findFirst.mockResolvedValue({
      id: "package-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      name: "8 月第 1 周 TikTok 素材包",
      status: "DRAFT",
      summary: "首周素材包结构。",
      project: {
        id: "project-1",
        name: "巴西新品上市",
      },
      files: [
        {
          id: "file-1",
          name: "素材包说明 PDF",
        },
      ],
    });
    mocks.tx.contentPackage.update.mockResolvedValue({
      id: "package-1",
      status: "REVIEW_NEEDED",
    });
    mocks.tx.reviewTask.findFirst.mockResolvedValue(null);
    mocks.tx.reviewTask.create.mockResolvedValue({
      id: "review-1",
    });
    mocks.tx.changeLog.create.mockResolvedValue({
      id: "log-1",
    });

    await submitContentPackageForReview({
      workspaceId: "workspace-1",
      userId: "user-1",
      contentPackageId: "package-1",
    });

    expect(mocks.tx.contentPackage.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        id: "package-1",
        status: {
          not: "ARCHIVED",
        },
      },
      include: {
        project: true,
        files: true,
      },
    });
    expect(mocks.tx.contentPackage.update).toHaveBeenCalledWith({
      where: {
        id: "package-1",
      },
      data: {
        status: "REVIEW_NEEDED",
      },
    });
    expect(mocks.tx.reviewTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        subjectType: "CONTENT_PACKAGE",
        subjectId: "package-1",
        status: "PENDING",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPackage",
        entityId: "package-1",
        action: "content_package_submitted_for_review",
        actorUserId: "user-1",
      }),
    });
  });

  it("rejects packages outside the current workspace", async () => {
    mocks.tx.contentPackage.findFirst.mockResolvedValue(null);

    await expect(
      submitContentPackageForReview({
        workspaceId: "workspace-1",
        userId: "user-1",
        contentPackageId: "package-from-another-workspace",
      }),
    ).rejects.toThrow("未找到当前 Workspace 下可提交审核的素材包");

    expect(mocks.tx.contentPackage.update).not.toHaveBeenCalled();
    expect(mocks.tx.reviewTask.create).not.toHaveBeenCalled();
  });
});

describe("attachAssetToPackageFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  });

  it("attaches an approved workspace asset to a package file and marks it generated", async () => {
    mocks.tx.contentPackageFile.findFirst.mockResolvedValue({
      id: "file-1",
      assetId: null,
      name: "模板化海报图片",
      status: "PLANNED",
      asset: null,
      contentPackage: {
        id: "package-1",
        name: "首月第一份素材包",
        projectId: "project-1",
        project: {
          id: "project-1",
          name: "巴西新品上市",
        },
      },
    });
    mocks.tx.asset.findFirst.mockResolvedValue({
      id: "asset-1",
      name: "模板化海报 4:5",
      status: "APPROVED",
    });
    mocks.tx.contentPackageFile.update.mockResolvedValue({
      id: "file-1",
      assetId: "asset-1",
      status: "GENERATED",
    });
    mocks.tx.changeLog.create.mockResolvedValue({
      id: "log-1",
    });

    await attachAssetToPackageFile({
      workspaceId: "workspace-1",
      userId: "user-1",
      fileId: "file-1",
      assetId: "asset-1",
    });

    expect(mocks.tx.contentPackageFile.findFirst).toHaveBeenCalledWith({
      where: {
        id: "file-1",
        contentPackage: {
          workspaceId: "workspace-1",
        },
      },
      include: {
        asset: true,
        contentPackage: {
          include: {
            project: true,
          },
        },
      },
    });
    expect(mocks.tx.asset.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        id: "asset-1",
        status: "APPROVED",
      },
    });
    expect(mocks.tx.contentPackageFile.update).toHaveBeenCalledWith({
      where: {
        id: "file-1",
      },
      data: {
        assetId: "asset-1",
        status: "GENERATED",
        notes: "已关联素材：模板化海报 4:5",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPackageFile",
        entityId: "file-1",
        action: "package_file_asset_attached",
        actorUserId: "user-1",
      }),
    });
  });

  it("rejects unapproved or cross-workspace assets", async () => {
    mocks.tx.contentPackageFile.findFirst.mockResolvedValue({
      id: "file-1",
      assetId: null,
      name: "模板化海报图片",
      status: "PLANNED",
      asset: null,
      contentPackage: {
        id: "package-1",
        name: "首月第一份素材包",
        projectId: "project-1",
        project: {
          id: "project-1",
          name: "巴西新品上市",
        },
      },
    });
    mocks.tx.asset.findFirst.mockResolvedValue(null);

    await expect(
      attachAssetToPackageFile({
        workspaceId: "workspace-1",
        userId: "user-1",
        fileId: "file-1",
        assetId: "unapproved-asset",
      }),
    ).rejects.toThrow("未找到当前 Workspace 下已审核的素材");

    expect(mocks.tx.contentPackageFile.update).not.toHaveBeenCalled();
  });
});
