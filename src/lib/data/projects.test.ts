import { describe, expect, it, vi, beforeEach } from "vitest";
import { kickoffProjectFromBrief } from "./projects";

const mocks = vi.hoisted(() => {
  const tx = {
    project: {
      create: vi.fn(),
    },
    product: {
      create: vi.fn(),
    },
    projectProduct: {
      create: vi.fn(),
    },
    productFact: {
      createMany: vi.fn(),
    },
    projectStrategy: {
      create: vi.fn(),
    },
    agentConversation: {
      create: vi.fn(),
    },
    agentMessage: {
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

describe("kickoffProjectFromBrief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.project.create.mockResolvedValue({
      id: "project-1",
      name: "巴西新品首月内容增长",
      description: "brief",
      status: "ACTIVE",
    });
    mocks.tx.product.create.mockResolvedValue({
      id: "product-1",
      name: "Aurora Cup 智能保温杯",
      description: "brief",
      status: "ACTIVE",
    });
    mocks.tx.projectProduct.create.mockResolvedValue({
      projectId: "project-1",
      productId: "product-1",
    });
    mocks.tx.productFact.createMany.mockResolvedValue({
      count: 8,
    });
    mocks.tx.projectStrategy.create.mockResolvedValue({
      id: "strategy-1",
      projectId: "project-1",
      version: 1,
    });
    mocks.tx.agentConversation.create.mockResolvedValue({
      id: "conversation-1",
    });
    mocks.tx.agentMessage.createMany.mockResolvedValue({
      count: 2,
    });
    mocks.tx.changeLog.create.mockResolvedValue({
      id: "log-1",
    });
  });

  it("creates a workspace-scoped project kickoff bundle from a Chinese brief", async () => {
    const kickoff = await kickoffProjectFromBrief(
      "workspace-1",
      {
        projectName: "巴西新品首月内容增长",
        productName: "Aurora Cup 智能保温杯",
        brief:
          "这是一款 600ml 不锈钢保温杯，24 小时保温，主推巴西市场，不做 LinkedIn，新增 TikTok，每周生成一次素材包，世界杯和通勤场景优先。",
      },
      "user-1",
    );

    expect(kickoff.project.id).toBe("project-1");
    expect(kickoff.product.id).toBe("product-1");
    expect(kickoff.factCount).toBe(8);
    expect(mocks.tx.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        status: "ACTIVE",
      }),
    });
    expect(mocks.tx.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        status: "ACTIVE",
      }),
    });
    expect(mocks.tx.projectProduct.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        productId: "product-1",
      },
    });
    expect(mocks.tx.productFact.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          workspaceId: "workspace-1",
          productId: "product-1",
          label: "产品名称",
          status: "DRAFT",
          source: "local-rule:kickoff",
        }),
        expect.objectContaining({
          label: "规格参数",
          value: expect.stringContaining("600ml"),
        }),
      ]),
    });
    expect(mocks.tx.projectStrategy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        status: "DRAFT",
        targetMarkets: ["巴西"],
        channels: expect.arrayContaining(["TikTok", "Instagram", "Facebook"]),
        packageFrequency: "WEEKLY",
      }),
    });
    expect(mocks.tx.agentMessage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          workspaceId: "workspace-1",
          conversationId: "conversation-1",
          role: "USER",
        }),
        expect.objectContaining({
          role: "ASSISTANT",
        }),
      ]),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "Project",
        action: "project_kickoff_created",
        actorUserId: "user-1",
      }),
    });
  });
});
