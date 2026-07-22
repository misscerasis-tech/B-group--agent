import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateStarterPlan, submitAgentCommand } from "./assistant";

const mocks = vi.hoisted(() => {
  const tx = {
    projectStrategy: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    agentConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    agentMessage: {
      create: vi.fn(),
    },
    agentOperation: {
      create: vi.fn(),
    },
    metricsSnapshot: {
      create: vi.fn(),
    },
    contentPlanItem: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    contentPackage: {
      create: vi.fn(),
    },
    contentPackageFile: {
      createMany: vi.fn(),
    },
    reminder: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
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

describe("generateStarterPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
    mocks.tx.project.findFirst.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      name: "巴西新品首月增长",
      description: "项目说明",
      status: "ACTIVE",
    });
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
    mocks.tx.contentPlanItem.findMany.mockResolvedValue([]);
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
    mocks.tx.agentConversation.findFirst.mockResolvedValue(null);
    mocks.tx.agentConversation.create.mockResolvedValue({
      id: "conversation-1",
    });
    mocks.tx.agentConversation.update.mockResolvedValue({
      id: "conversation-1",
    });
    mocks.tx.agentMessage.create.mockResolvedValue({
      id: "message-1",
    });
    mocks.tx.agentOperation.create.mockResolvedValue({
      id: "operation-1",
      status: "APPLIED",
    });
    mocks.tx.metricsSnapshot.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "metric-1",
        ...data,
      }),
    );
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

  it("records metrics from a Chinese agent command", async () => {
    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "记录 2026-07 第3周 TikTok 曝光10000 点击600 转化24 花费1234.56 元。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.agentOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        status: "APPLIED",
        summary: expect.stringContaining("录入指标"),
      }),
    });
    expect(mocks.tx.metricsSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        period: "2026-07 第3周",
        channel: "TikTok",
        impressions: 10000,
        clicks: 600,
        conversions: 24,
        spendCents: 123456,
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "MetricsSnapshot",
        action: "agent_metrics_snapshot_created",
        actorUserId: "user-1",
      }),
    });
  });

  it("creates a content plan item from a Chinese agent command", async () => {
    mocks.tx.contentPlanItem.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "plan-created-from-agent",
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "第2周 TikTok 做一条开箱短视频，主题新品认知，交付短视频脚本，截止 2026-08-07，可执行。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPlanItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        strategyId: "strategy-1",
        week: 2,
        channel: "TikTok",
        theme: "新品认知",
        title: "开箱短视频",
        deliverable: "短视频脚本",
        dueDate: new Date("2026-08-07T00:00:00"),
        status: "READY",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPlanItem",
        entityId: "plan-created-from-agent",
        action: "agent_plan_item_created",
        actorUserId: "user-1",
      }),
    });
  });

  it("creates a content package structure from a Chinese agent command", async () => {
    mocks.tx.contentPackage.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "package-created-from-agent",
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "为 2026-08 第1周创建 TikTok 素材包。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPackage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        strategyId: "strategy-1",
        name: "2026-08 第1周 TikTok 素材包",
        period: "2026-08 第1周",
        frequency: "WEEKLY",
        status: "DRAFT",
      }),
    });
    expect(mocks.tx.contentPackageFile.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          contentPackageId: "package-created-from-agent",
          name: "素材包说明 PDF",
          status: "PLANNED",
        }),
        expect.objectContaining({
          contentPackageId: "package-created-from-agent",
          name: "最终 ZIP 打包下载",
          status: "PLANNED",
        }),
      ]),
    });
    expect(mocks.tx.contentPackageFile.createMany.mock.calls.at(-1)?.[0].data).toHaveLength(11);
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPackage",
        entityId: "package-created-from-agent",
        action: "agent_content_package_created",
        summary: "创建素材包结构：2026-08 第1周 TikTok 素材包",
        actorUserId: "user-1",
      }),
    });
  });

  it("completes an open reminder from a Chinese agent command", async () => {
    const reminder = {
      id: "reminder-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      title: "抽奖规则需要提前确认",
      description: "发布前确认奖品、规则和免责声明。",
      severity: "WARNING",
      status: "OPEN",
      dueAt: new Date("2026-07-24T00:00:00.000Z"),
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    };
    mocks.tx.reminder.count.mockResolvedValue(1);
    mocks.tx.reminder.findFirst.mockResolvedValue(reminder);
    mocks.tx.reminder.update.mockResolvedValue({
      ...reminder,
      status: "DONE",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把抽奖规则提醒标记完成。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reminder.update).toHaveBeenCalledWith({
      where: {
        id: "reminder-1",
      },
      data: {
        status: "DONE",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "Reminder",
        entityId: "reminder-1",
        action: "agent_reminder_completed",
        summary: "完成提醒：抽奖规则",
        actorUserId: "user-1",
      }),
    });
  });

  it("completes a matching content plan item from a Chinese agent command", async () => {
    const planItem = {
      id: "plan-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      strategyId: "strategy-1",
      week: 2,
      channel: "TikTok",
      theme: "新品认知",
      title: "开箱短视频",
      deliverable: "短视频脚本",
      dueDate: new Date("2026-08-07T00:00:00.000Z"),
      status: "READY",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    };
    mocks.tx.contentPlanItem.count.mockResolvedValue(1);
    mocks.tx.contentPlanItem.findFirst.mockResolvedValue(planItem);
    mocks.tx.contentPlanItem.update.mockResolvedValue({
      ...planItem,
      status: "DONE",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "第2周 TikTok 开箱短视频已完成。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPlanItem.update).toHaveBeenCalledWith({
      where: {
        id: "plan-1",
      },
      data: {
        status: "DONE",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPlanItem",
        entityId: "plan-1",
        action: "agent_plan_item_completed",
        summary: "完成内容计划：第2周 · TikTok · 开箱",
        actorUserId: "user-1",
      }),
    });
  });

  it("fails safely when a completion command cannot match a target", async () => {
    mocks.tx.reminder.count.mockResolvedValue(0);

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把不存在的提醒标记完成。",
    });

    expect(result.status).toBe("FAILED");
    expect(mocks.tx.reminder.update).not.toHaveBeenCalled();
    expect(mocks.tx.agentOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "FAILED",
        conflictCheck: expect.stringContaining("未找到标题或说明包含「不存在的」的开放提醒"),
      }),
    });
  });

  it("warns when a confirmed strategy change removes an active plan channel", async () => {
    mocks.tx.projectStrategy.findFirst.mockResolvedValue({
      id: "strategy-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      version: 1,
      status: "CONFIRMED",
      targetMarkets: ["巴西"],
      audiences: ["礼品购买者"],
      channels: ["LinkedIn"],
      contentDirections: ["新品认知"],
      packageFrequency: "WEEKLY",
      positioning: "面向礼品购买者",
      rationale: "已确认策略",
      confirmedAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    mocks.tx.contentPlanItem.findMany.mockResolvedValue([
      {
        channel: "LinkedIn",
        week: 1,
        title: "LinkedIn 产品故事长文",
      },
    ]);

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "不做 LinkedIn。",
    });

    expect(result.status).toBe("PENDING_CONFIRMATION");
    expect(mocks.tx.agentOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PENDING_CONFIRMATION",
        conflictCheck: expect.stringContaining("应用后策略将没有任何投放渠道"),
      }),
    });
    expect(mocks.tx.agentOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conflictCheck: expect.stringContaining("内容日历仍有 1 个未完成计划使用 LinkedIn"),
      }),
    });
  });
});
