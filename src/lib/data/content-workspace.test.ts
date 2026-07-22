import { describe, expect, it, vi, beforeEach } from "vitest";
import { createContentPackage } from "./content-workspace";

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
    },
    contentPackageFile: {
      createMany: vi.fn(),
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
    mocks.tx.contentPackageFile.createMany.mockResolvedValue({ count: 10 });
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
    expect(createdFiles).toHaveLength(10);
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
