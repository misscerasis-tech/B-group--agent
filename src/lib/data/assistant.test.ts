import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateStarterPlan, submitAgentCommand } from "./assistant";

const mocks = vi.hoisted(() => {
  const tx = {
    projectStrategy: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
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
      count: vi.fn(),
      findMany: vi.fn(),
    },
    contentPlanItem: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    projectProduct: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    productFact: {
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    asset: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    contentPackage: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    contentPackageFile: {
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    reminder: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    reviewTask: {
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

  it("creates a project reminder with an explicit due date from a Chinese agent command", async () => {
    mocks.tx.reminder.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "reminder-with-due-date",
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "提醒我 2026-08-07 前确认巴西抽奖奖品和活动规则。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        title: "2026-08-07 前确认巴西抽奖奖品和活动规则",
        severity: "INFO",
        status: "OPEN",
        dueAt: new Date("2026-08-07T00:00:00"),
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "Reminder",
        entityId: "reminder-with-due-date",
        action: "agent_reminder_created",
        actorUserId: "user-1",
      }),
    });
  });

  it("creates reminders from current project metrics risks", async () => {
    mocks.tx.metricsSnapshot.count.mockResolvedValue(1);
    mocks.tx.metricsSnapshot.findMany.mockResolvedValue([
      {
        id: "metric-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        project: {
          name: "巴西新品首月增长",
        },
        period: "2026-07 第3周",
        channel: "TikTok",
        impressions: 1200,
        clicks: 0,
        conversions: 0,
        spendCents: 0,
        notes: null,
        capturedAt: new Date("2026-07-22T00:00:00.000Z"),
        createdAt: new Date("2026-07-22T00:00:00.000Z"),
        updatedAt: new Date("2026-07-22T00:00:00.000Z"),
      },
    ]);
    mocks.tx.reminder.findFirst.mockResolvedValue(null);
    mocks.tx.reminder.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "reminder-from-metrics-risk",
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把数据复盘风险生成提醒。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        title: "曝光无点击：TikTok 2026-07 第3周",
        severity: "CRITICAL",
        status: "OPEN",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "MetricsSnapshot",
        entityId: "project-1",
        action: "agent_metrics_risk_reminders_generated",
        summary: "根据数据复盘风险生成提醒：新增 1 条。",
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

  it("creates reminders from content calendar gaps", async () => {
    mocks.tx.contentPlanItem.findMany.mockResolvedValue([
      {
        week: 1,
        channel: "TikTok",
      },
    ]);
    mocks.tx.reminder.findFirst.mockResolvedValue(null);
    mocks.tx.reminder.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `reminder-${data.title}`,
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把内容日历缺口生成提醒。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        title: "巴西新品首月增长：Instagram 尚未排入内容日历",
        severity: "WARNING",
        status: "OPEN",
      }),
    });
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "巴西新品首月增长：第2周缺少内容计划",
        severity: "INFO",
      }),
    });
    expect(mocks.tx.reminder.create).toHaveBeenCalledTimes(4);
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPlanItem",
        entityId: "project-1",
        action: "agent_calendar_gap_reminders_generated",
        summary: "根据内容日历缺口生成提醒：新增 4 条。",
        actorUserId: "user-1",
      }),
    });
  });

  it("creates a product fact for the linked product from a Chinese agent command", async () => {
    mocks.tx.projectProduct.count.mockResolvedValue(1);
    mocks.tx.projectProduct.findFirst.mockResolvedValue({
      projectId: "project-1",
      productId: "product-1",
      product: {
        id: "product-1",
        workspaceId: "workspace-1",
        name: "Aurora Cup",
      },
    });
    mocks.tx.productFact.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "fact-created-from-agent",
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "新增产品事实：卖点=24小时保温。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.productFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        productId: "product-1",
        label: "核心卖点",
        value: "24小时保温",
        source: "B组 Agent 中文指令",
        confidence: 90,
        status: "NEEDS_REVIEW",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ProductFact",
        entityId: "fact-created-from-agent",
        action: "agent_product_fact_created",
        summary: "新增产品事实：核心卖点=24小时保温",
        actorUserId: "user-1",
      }),
    });
  });

  it("creates project health reminders from a Chinese agent command", async () => {
    mocks.tx.project.findFirst
      .mockResolvedValueOnce({
        id: "project-1",
        workspaceId: "workspace-1",
        name: "巴西新品首月增长",
        description: "项目说明",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "project-1",
        name: "巴西新品首月增长",
        status: "ACTIVE",
        projectProducts: [],
      });
    mocks.tx.projectStrategy.count.mockResolvedValue(0);
    mocks.tx.contentPlanItem.count.mockResolvedValue(0);
    mocks.tx.contentPackage.count.mockResolvedValue(0);
    mocks.tx.reviewTask.count.mockResolvedValue(0);
    mocks.tx.asset.count.mockResolvedValue(0);
    mocks.tx.metricsSnapshot.count.mockResolvedValue(0);
    mocks.tx.reminder.count.mockResolvedValue(0);
    mocks.tx.reminder.findFirst.mockResolvedValue(null);
    mocks.tx.reminder.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `reminder-${data.title}`,
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把项目体检缺口生成提醒。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        title: "巴西新品首月增长：关联至少一个产品",
        severity: "WARNING",
        status: "OPEN",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "Project",
        entityId: "project-1",
        action: "agent_project_health_reminders_generated",
        summary: expect.stringContaining("新增"),
        actorUserId: "user-1",
      }),
    });
  });

  it("infers multiple product facts from pasted material for the linked product", async () => {
    mocks.tx.projectProduct.count.mockResolvedValue(1);
    mocks.tx.projectProduct.findFirst.mockResolvedValue({
      projectId: "project-1",
      productId: "product-1",
      product: {
        id: "product-1",
        workspaceId: "workspace-1",
        name: "Aurora Cup",
        description: "智能温显保温杯，500ml，不锈钢。",
        facts: [],
      },
    });
    mocks.tx.productFact.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `fact-${data.label}`,
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "请从产品资料提取产品事实：智能温显保温杯，500ml，不锈钢，适合通勤和健身，24小时保温，防漏便携。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.productFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        productId: "product-1",
        label: "核心卖点",
        value: expect.stringContaining("温度显示"),
        source: "B组 Agent 中文资料提取",
        status: "NEEDS_REVIEW",
      }),
    });
    expect(mocks.tx.productFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        label: "规格参数",
        value: expect.stringContaining("容量 500ml"),
      }),
    });
    expect(mocks.tx.productFact.create).toHaveBeenCalledTimes(8);
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ProductFact",
        entityId: "product-1",
        action: "agent_product_facts_inferred",
        summary: expect.stringContaining("新增 8 条"),
        actorUserId: "user-1",
      }),
    });
  });

  it("creates a new draft strategy recommendation without overwriting a confirmed strategy", async () => {
    mocks.tx.projectProduct.findFirst.mockResolvedValue({
      projectId: "project-1",
      productId: "product-1",
      product: {
        id: "product-1",
        workspaceId: "workspace-1",
        facts: [
          {
            id: "fact-1",
            label: "核心卖点",
            value: "24小时保温、防漏便携、温度显示",
            status: "CONFIRMED",
          },
        ],
      },
    });
    mocks.tx.projectProduct.findMany.mockResolvedValue([
      {
        projectId: "project-1",
        productId: "product-1",
        product: {
          id: "product-1",
          workspaceId: "workspace-1",
          name: "Aurora Cup",
          description: "巴西上市新品",
          facts: [
            {
              id: "fact-1",
              label: "核心卖点",
              value: "24小时保温、防漏便携、温度显示",
              status: "CONFIRMED",
            },
            {
              id: "fact-2",
              label: "目标场景",
              value: "通勤、健身、节日礼品",
              status: "NEEDS_REVIEW",
            },
          ],
        },
      },
    ]);
    mocks.tx.projectStrategy.create.mockResolvedValue({
      id: "strategy-2",
      workspaceId: "workspace-1",
      projectId: "project-1",
      version: 2,
      status: "DRAFT",
      targetMarkets: ["巴西"],
      audiences: ["年轻通勤人群", "健身和户外用户", "礼品购买者"],
      channels: ["TikTok", "Instagram", "Facebook"],
      contentDirections: ["新品认知", "长效保温场景", "通勤随身", "运动户外", "节日礼赠"],
      packageFrequency: "WEEKLY",
      positioning: "Aurora Cup 面向 年轻通勤人群、健身和户外用户，以 新品认知、长效保温场景 切入 巴西。",
      rationale: "基于 1 个关联产品和 2 条产品事实生成本地规则型策略草案。",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "请根据产品事实推荐一版巴西首月增长策略。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.projectStrategy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        version: 2,
        status: "DRAFT",
        targetMarkets: ["巴西"],
        channels: expect.arrayContaining(["TikTok", "Instagram", "Facebook"]),
        packageFrequency: "WEEKLY",
      }),
    });
    expect(mocks.tx.projectStrategy.update).not.toHaveBeenCalled();
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ProjectStrategy",
        entityId: "strategy-2",
        action: "agent_strategy_recommended",
        summary: "根据产品事实生成策略推荐草案",
        actorUserId: "user-1",
      }),
    });
  });

  it("confirms unreviewed product facts for the current project products", async () => {
    mocks.tx.projectProduct.findMany.mockResolvedValue([
      {
        productId: "product-1",
      },
    ]);
    mocks.tx.productFact.count.mockResolvedValue(2);
    mocks.tx.productFact.findMany.mockResolvedValue([
      {
        id: "fact-1",
        productId: "product-1",
        label: "核心卖点",
        value: "24小时保温",
        source: "B组 Agent 中文资料提取",
        confidence: 90,
        status: "NEEDS_REVIEW",
        createdAt: new Date("2026-07-22T00:00:00.000Z"),
      },
      {
        id: "fact-2",
        productId: "product-1",
        label: "规格参数",
        value: "500ml",
        source: "B组 Agent 中文资料提取",
        confidence: 80,
        status: "DRAFT",
        createdAt: new Date("2026-07-22T00:00:00.000Z"),
      },
    ]);
    mocks.tx.productFact.updateMany.mockResolvedValue({
      count: 2,
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "确认当前项目所有产品事实。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.productFact.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: "workspace-1",
        id: {
          in: ["fact-1", "fact-2"],
        },
      }),
      data: {
        status: "CONFIRMED",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ProductFact",
        entityId: "project-1",
        action: "agent_product_facts_confirmed",
        summary: "确认当前项目待复核产品事实：确认 2 条。",
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

  it("creates reminders from the latest content package readiness gaps", async () => {
    const contentPackage = {
      id: "package-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      strategyId: "strategy-1",
      name: "2026-08 第1周 TikTok 素材包",
      period: "2026-08 第1周",
      frequency: "WEEKLY",
      status: "DRAFT",
      summary: "待补齐素材。",
      updatedAt: new Date("2026-07-22T00:00:00.000Z"),
      project: {
        id: "project-1",
        name: "巴西新品首月增长",
        projectProducts: [
          {
            productId: "product-1",
          },
        ],
      },
      files: [
        {
          id: "file-1",
          status: "PLANNED",
          asset: null,
          createdAt: new Date("2026-07-22T00:00:00.000Z"),
        },
      ],
    };
    mocks.tx.contentPackage.count.mockResolvedValue(1);
    mocks.tx.contentPackage.findFirst.mockResolvedValue(contentPackage);
    mocks.tx.asset.findMany.mockResolvedValue([]);
    mocks.tx.reminder.findFirst.mockResolvedValue(null);
    mocks.tx.reminder.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `reminder-${data.title}`,
        ...data,
      }),
    );

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把最新素材包可交付性缺口生成提醒。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        title: "2026-08 第1周 TikTok 素材包：先生成文件内容",
        severity: "WARNING",
        status: "OPEN",
      }),
    });
    expect(mocks.tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "2026-08 第1周 TikTok 素材包：关联真实产品图和 Logo",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPackage",
        entityId: "package-1",
        action: "agent_package_readiness_reminders_generated",
        summary: expect.stringContaining("新增 2 条"),
        actorUserId: "user-1",
      }),
    });
  });

  it("updates all files in the latest content package from a Chinese agent command", async () => {
    const contentPackage = {
      id: "package-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      strategyId: "strategy-1",
      name: "2026-08 第1周 TikTok 素材包",
      period: "2026-08 第1周",
      frequency: "WEEKLY",
      status: "DRAFT",
      summary: "待生成素材。",
      updatedAt: new Date("2026-07-22T00:00:00.000Z"),
      files: [
        {
          id: "file-1",
          status: "PLANNED",
        },
        {
          id: "file-2",
          status: "PLANNED",
        },
      ],
    };
    mocks.tx.contentPackage.count.mockResolvedValue(1);
    mocks.tx.contentPackage.findFirst.mockResolvedValue(contentPackage);
    mocks.tx.contentPackageFile.updateMany.mockResolvedValue({
      count: 2,
    });
    mocks.tx.contentPackage.update.mockResolvedValue({
      ...contentPackage,
      status: "GENERATED",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把最新素材包全部文件标记为已生成。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPackageFile.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["file-1", "file-2"],
        },
        contentPackageId: "package-1",
      },
      data: {
        status: "GENERATED",
      },
    });
    expect(mocks.tx.contentPackage.update).toHaveBeenCalledWith({
      where: {
        id: "package-1",
      },
      data: {
        status: "GENERATED",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPackage",
        entityId: "package-1",
        action: "agent_package_files_status_updated",
        summary: "全部文件标记为已生成：最新素材包：更新 2 个文件项。",
        actorUserId: "user-1",
      }),
    });
  });

  it("attaches the latest approved poster asset to the latest content package", async () => {
    const contentPackage = {
      id: "package-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      strategyId: "strategy-1",
      name: "2026-08 第1周 TikTok 素材包",
      period: "2026-08 第1周",
      frequency: "WEEKLY",
      status: "DRAFT",
      summary: "待生成素材。",
      updatedAt: new Date("2026-07-22T00:00:00.000Z"),
      files: [
        {
          id: "file-poster",
          name: "模板化海报图片",
          assetId: null,
          status: "PLANNED",
          notes: null,
        },
      ],
    };
    const posterAsset = {
      id: "asset-poster",
      workspaceId: "workspace-1",
      projectId: "project-1",
      productId: "product-1",
      name: "模板化海报 4:5",
      kind: "GENERATED_IMAGE",
      status: "APPROVED",
      updatedAt: new Date("2026-07-22T01:00:00.000Z"),
    };
    mocks.tx.contentPackage.findFirst.mockResolvedValue(contentPackage);
    mocks.tx.projectProduct.findMany.mockResolvedValue([
      {
        productId: "product-1",
      },
    ]);
    mocks.tx.asset.count.mockResolvedValue(1);
    mocks.tx.asset.findFirst.mockResolvedValue(posterAsset);
    mocks.tx.contentPackageFile.update.mockResolvedValue({
      ...contentPackage.files[0],
      assetId: "asset-poster",
      status: "GENERATED",
      notes: "已关联素材：模板化海报 4:5",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "把最新模板海报关联到最新素材包。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPackageFile.update).toHaveBeenCalledWith({
      where: {
        id: "file-poster",
      },
      data: {
        assetId: "asset-poster",
        status: "GENERATED",
        notes: "已关联素材：模板化海报 4:5",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPackageFile",
        entityId: "file-poster",
        action: "agent_poster_asset_attached_to_package",
        summary: "关联模板海报到素材包：最新素材包",
        actorUserId: "user-1",
      }),
    });
  });

  it("submits the latest content package for review from a Chinese agent command", async () => {
    const contentPackage = {
      id: "package-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      strategyId: "strategy-1",
      name: "2026-08 第1周 TikTok 素材包",
      period: "2026-08 第1周",
      frequency: "WEEKLY",
      status: "DRAFT",
      summary: "待审核素材包。",
      updatedAt: new Date("2026-07-22T00:00:00.000Z"),
      project: {
        id: "project-1",
        name: "巴西新品首月增长",
      },
      files: [
        {
          id: "file-1",
          name: "素材包说明 PDF",
        },
      ],
    };
    mocks.tx.contentPackage.count.mockResolvedValue(1);
    mocks.tx.contentPackage.findFirst.mockResolvedValue(contentPackage);
    mocks.tx.contentPackage.update.mockResolvedValue({
      ...contentPackage,
      status: "REVIEW_NEEDED",
    });
    mocks.tx.reviewTask.findFirst.mockResolvedValue(null);
    mocks.tx.reviewTask.create.mockResolvedValue({
      id: "review-1",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "提交最新素材包审核。",
    });

    expect(result.status).toBe("APPLIED");
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
        action: "agent_content_package_submitted_for_review",
        summary: "提交素材包审核：最新素材包",
        actorUserId: "user-1",
      }),
    });
  });

  it("approves a pending content package review from a Chinese agent command", async () => {
    const reviewTask = {
      id: "review-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      subjectType: "CONTENT_PACKAGE",
      subjectId: "package-1",
      title: "审核素材包：2026-08 第1周 TikTok 素材包",
      description: "巴西新品首月增长 · 11 个文件项",
      status: "PENDING",
      reviewerUserId: null,
      decisionNote: null,
      dueAt: null,
      decidedAt: null,
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    };
    mocks.tx.reviewTask.count.mockResolvedValue(1);
    mocks.tx.reviewTask.findFirst.mockResolvedValue(reviewTask);
    mocks.tx.reviewTask.update.mockResolvedValue({
      ...reviewTask,
      status: "APPROVED",
      reviewerUserId: "user-1",
      decisionNote: "由 B 组 Agent 中文指令处理。",
      decidedAt: new Date("2026-07-22T01:00:00.000Z"),
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "最新素材包审核通过。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPackage.updateMany).toHaveBeenCalledWith({
      where: {
        id: "package-1",
        workspaceId: "workspace-1",
      },
      data: {
        status: "APPROVED",
      },
    });
    expect(mocks.tx.reviewTask.update).toHaveBeenCalledWith({
      where: {
        id: "review-1",
      },
      data: expect.objectContaining({
        status: "APPROVED",
        reviewerUserId: "user-1",
        decisionNote: "由 B 组 Agent 中文指令处理。",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ReviewTask",
        entityId: "review-1",
        action: "agent_content_package_review_approved",
        summary: "审核通过：最新素材包",
        actorUserId: "user-1",
      }),
    });
  });

  it("approves a pending product fact review from a Chinese agent command", async () => {
    const reviewTask = {
      id: "review-fact-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      subjectType: "PRODUCT_FACT",
      subjectId: "fact-1",
      title: "确认产品事实：核心卖点",
      description: "24小时保温",
      status: "PENDING",
      reviewerUserId: null,
      decisionNote: null,
      dueAt: null,
      decidedAt: null,
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    };
    mocks.tx.projectProduct.findMany.mockResolvedValue([
      {
        productId: "product-1",
      },
    ]);
    mocks.tx.productFact.findMany.mockResolvedValue([
      {
        id: "fact-1",
      },
    ]);
    mocks.tx.reviewTask.count.mockResolvedValue(1);
    mocks.tx.reviewTask.findFirst.mockResolvedValue(reviewTask);
    mocks.tx.reviewTask.update.mockResolvedValue({
      ...reviewTask,
      status: "APPROVED",
      reviewerUserId: "user-1",
      decisionNote: "由 B 组 Agent 中文指令处理。",
      decidedAt: new Date("2026-07-22T01:00:00.000Z"),
    });
    mocks.tx.productFact.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "产品事实审核通过。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.productFact.updateMany).toHaveBeenCalledWith({
      where: {
        id: "fact-1",
        workspaceId: "workspace-1",
      },
      data: {
        status: "CONFIRMED",
      },
    });
    expect(mocks.tx.reviewTask.update).toHaveBeenCalledWith({
      where: {
        id: "review-fact-1",
      },
      data: expect.objectContaining({
        status: "APPROVED",
        reviewerUserId: "user-1",
        decisionNote: "由 B 组 Agent 中文指令处理。",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ReviewTask",
        entityId: "review-fact-1",
        action: "agent_review_task_approved",
        summary: "产品事实审核通过",
        actorUserId: "user-1",
      }),
    });
  });

  it("cancels a pending review task from a Chinese agent command", async () => {
    const reviewTask = {
      id: "review-package-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      subjectType: "CONTENT_PACKAGE",
      subjectId: "package-1",
      title: "审核素材包：2026-08 第1周 TikTok 素材包",
      description: "误生成的审核任务",
      status: "PENDING",
      reviewerUserId: null,
      decisionNote: null,
      dueAt: null,
      decidedAt: null,
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    };
    mocks.tx.reviewTask.count.mockResolvedValue(1);
    mocks.tx.reviewTask.findFirst.mockResolvedValue(reviewTask);
    mocks.tx.reviewTask.update.mockResolvedValue({
      ...reviewTask,
      status: "CANCELED",
      reviewerUserId: "user-1",
      decisionNote: "由 B 组 Agent 中文指令取消。",
      decidedAt: new Date("2026-07-22T01:00:00.000Z"),
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "取消最新素材包审核任务。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reviewTask.update).toHaveBeenCalledWith({
      where: {
        id: "review-package-1",
      },
      data: expect.objectContaining({
        status: "CANCELED",
        reviewerUserId: "user-1",
        decisionNote: "由 B 组 Agent 中文指令取消。",
      }),
    });
    expect(mocks.tx.contentPackage.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ReviewTask",
        entityId: "review-package-1",
        action: "agent_review_task_canceled",
        summary: "取消素材包审核任务",
        actorUserId: "user-1",
      }),
    });
  });

  it("creates missing review tasks for the current project", async () => {
    mocks.tx.project.findFirst
      .mockResolvedValueOnce({
        id: "project-1",
        workspaceId: "workspace-1",
        name: "巴西新品首月增长",
        description: "项目说明",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "project-1",
        name: "巴西新品首月增长",
        projectProducts: [
          {
            productId: "product-1",
          },
        ],
      });
    mocks.tx.projectStrategy.findMany.mockResolvedValue([
      {
        id: "strategy-draft-1",
        version: 2,
      },
    ]);
    mocks.tx.contentPackage.findMany.mockResolvedValue([
      {
        id: "package-1",
        name: "2026-08 第1周 TikTok 素材包",
        summary: "待审核素材包。",
        files: [
          {
            id: "file-1",
          },
        ],
      },
    ]);
    mocks.tx.asset.findMany.mockResolvedValue([
      {
        id: "asset-1",
        name: "产品主图.png",
        projectId: "project-1",
      },
    ]);
    mocks.tx.productFact.findMany.mockResolvedValue([
      {
        id: "fact-1",
        label: "核心卖点",
        value: "24小时保温",
      },
    ]);
    mocks.tx.reviewTask.findFirst.mockResolvedValue(null);
    mocks.tx.reviewTask.create.mockResolvedValue({
      id: "review-created",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "补齐当前项目审核中心任务。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reviewTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        subjectType: "PROJECT_STRATEGY",
        subjectId: "strategy-draft-1",
        title: "确认策略草案：巴西新品首月增长 v2",
        status: "PENDING",
      }),
    });
    expect(mocks.tx.reviewTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subjectType: "CONTENT_PACKAGE",
        subjectId: "package-1",
      }),
    });
    expect(mocks.tx.reviewTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subjectType: "ASSET",
        subjectId: "asset-1",
      }),
    });
    expect(mocks.tx.reviewTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subjectType: "PRODUCT_FACT",
        subjectId: "fact-1",
      }),
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ReviewTask",
        entityId: "project-1",
        action: "agent_missing_review_tasks_created",
        summary: "补齐当前项目审核任务：新增 4 条。",
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

  it("dismisses an open reminder from a Chinese agent command", async () => {
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
      status: "DISMISSED",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "忽略抽奖规则提醒。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.reminder.update).toHaveBeenCalledWith({
      where: {
        id: "reminder-1",
      },
      data: {
        status: "DISMISSED",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "Reminder",
        entityId: "reminder-1",
        action: "agent_reminder_dismissed",
        summary: "忽略提醒：抽奖规则",
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

  it("updates a matching content plan item status from a Chinese agent command", async () => {
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
      status: "REVIEW_NEEDED",
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "第2周 TikTok 开箱短视频标记为需审核。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPlanItem.update).toHaveBeenCalledWith({
      where: {
        id: "plan-1",
      },
      data: {
        status: "REVIEW_NEEDED",
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPlanItem",
        entityId: "plan-1",
        action: "agent_plan_item_status_updated",
        summary: "内容计划改为需审核：第2周 · TikTok · 开箱",
        actorUserId: "user-1",
      }),
    });
  });

  it("updates a matching content plan item due date from a Chinese agent command", async () => {
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
      dueDate: new Date("2026-08-10T00:00:00.000Z"),
    });

    const result = await submitAgentCommand({
      workspaceId: "workspace-1",
      userId: "user-1",
      projectId: "project-1",
      text: "第2周 TikTok 开箱短视频截止日期改到 2026-08-10。",
    });

    expect(result.status).toBe("APPLIED");
    expect(mocks.tx.contentPlanItem.update).toHaveBeenCalledWith({
      where: {
        id: "plan-1",
      },
      data: {
        dueDate: new Date("2026-08-10T00:00:00"),
      },
    });
    expect(mocks.tx.changeLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entityType: "ContentPlanItem",
        entityId: "plan-1",
        action: "agent_plan_item_due_date_updated",
        summary: "内容计划截止日期改为 2026-08-10：第2周 · TikTok · 开箱",
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
