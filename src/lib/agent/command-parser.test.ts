import {
  ContentFrequency,
  PackageFileStatus,
  PlanItemStatus,
  ProjectStatus,
  ReminderSeverity,
  ReviewSubjectType,
  ReviewTaskStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseAgentCommand } from "./command-parser";

describe("parseAgentCommand", () => {
  it("turns a Chinese channel and frequency request into structured operations", () => {
    const parsed = parseAgentCommand("巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。");

    expect(parsed.operations).toEqual([
      {
        type: "set_market",
        value: "巴西",
        label: "目标市场设为：巴西",
      },
      {
        type: "add_channel",
        value: "TikTok",
        label: "新增渠道：TikTok",
      },
      {
        type: "remove_channel",
        value: "LinkedIn",
        label: "删除渠道：LinkedIn",
      },
      {
        type: "set_package_frequency",
        value: ContentFrequency.WEEKLY,
        label: "素材包生成频率改为：每周一次",
      },
    ]);
    expect(parsed.confidence).toBe("high");
  });

  it("extracts cultural and campaign content direction hints", () => {
    const parsed = parseAgentCommand("这个月围绕世界杯与那达慕做 Facebook 活动，每两周生成一次素材包。");

    expect(parsed.operations).toContainEqual({
      type: "add_content_direction",
      value: "世界杯",
      label: "新增内容方向：世界杯",
    });
    expect(parsed.operations).toContainEqual({
      type: "add_content_direction",
      value: "那达慕",
      label: "新增内容方向：那达慕",
    });
    expect(parsed.operations).toContainEqual({
      type: "set_package_frequency",
      value: ContentFrequency.BIWEEKLY,
      label: "素材包生成频率改为：每两周一次",
    });
  });

  it("extracts audience and content direction removals", () => {
    const parsed = parseAgentCommand("不要学生用户，新增礼品购买者，本月不做小抽奖。");

    expect(parsed.operations).toContainEqual({
      type: "remove_audience",
      value: "学生用户",
      label: "删除客群：学生用户",
    });
    expect(parsed.operations).toContainEqual({
      type: "add_audience",
      value: "礼品购买者",
      label: "新增客群：礼品购买者",
    });
    expect(parsed.operations).toContainEqual({
      type: "remove_content_direction",
      value: "小抽奖",
      label: "删除内容方向：小抽奖",
    });
  });

  it("extracts project status changes", () => {
    const parsed = parseAgentCommand("暂停这个项目，新增 TikTok，下个月每周生成一次素材包。");

    expect(parsed.operations).toContainEqual({
      type: "set_project_status",
      value: ProjectStatus.PAUSED,
      label: "项目状态改为：暂停",
    });
    expect(parsed.operations).toContainEqual({
      type: "add_channel",
      value: "TikTok",
      label: "新增渠道：TikTok",
    });
  });

  it("extracts strategy recommendation requests", () => {
    const parsed = parseAgentCommand("请根据产品事实推荐一版巴西首月增长策略。");

    expect(parsed.operations).toContainEqual({
      type: "recommend_strategy",
      value: {
        basis: "product_facts",
        contextText: "请根据产品事实推荐一版巴西首月增长策略。",
      },
      label: "根据产品事实生成策略推荐草案",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts reminder creation requests", () => {
    const parsed = parseAgentCommand("提醒我提前确认巴西抽奖奖品和活动规则，这是重要风险。");

    expect(parsed.operations).toContainEqual({
      type: "create_reminder",
      value: "提前确认巴西抽奖奖品和活动规则 这是重要风险",
      severity: ReminderSeverity.WARNING,
      label: "创建风险提醒：提前确认巴西抽奖奖品和活动规则 这是重要风险",
    });
  });

  it("extracts explicit due dates from reminder creation requests", () => {
    const parsed = parseAgentCommand("提醒我 2026-08-07 前确认巴西抽奖奖品和活动规则。");

    expect(parsed.operations).toContainEqual({
      type: "create_reminder",
      value: "2026-08-07 前确认巴西抽奖奖品和活动规则",
      severity: ReminderSeverity.INFO,
      dueAt: "2026-08-07",
      label: "创建提示提醒：2026-08-07 前确认巴西抽奖奖品和活动规则",
    });
  });

  it("extracts project health reminder generation requests", () => {
    const parsed = parseAgentCommand("把项目体检缺口生成提醒。");

    expect(parsed.operations).toContainEqual({
      type: "create_project_health_reminders",
      value: {
        limit: 4,
      },
      label: "根据项目体检缺口生成提醒",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts product fact creation requests", () => {
    const parsed = parseAgentCommand("新增产品事实：卖点=24小时保温。");

    expect(parsed.operations).toContainEqual({
      type: "create_product_fact",
      value: {
        label: "核心卖点",
        value: "24小时保温",
        source: "B组 Agent 中文指令",
      },
      label: "新增产品事实：核心卖点=24小时保温",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts product fact inference from pasted Chinese product material", () => {
    const parsed = parseAgentCommand(
      "请从产品资料提取产品事实：智能温显保温杯，500ml，不锈钢，适合通勤和健身，24小时保温，防漏便携。",
    );

    expect(parsed.operations).toEqual([
      expect.objectContaining({
        type: "infer_product_facts_from_text",
        value: {
          sourceText: "智能温显保温杯，500ml，不锈钢，适合通勤和健身，24小时保温，防漏便携。",
          source: "B组 Agent 中文资料提取",
        },
        label: expect.stringContaining("从产品资料提取事实：智能温显保温杯"),
      }),
    ]);
    expect(parsed.confidence).toBe("high");
  });

  it("extracts product fact confirmation requests", () => {
    const parsed = parseAgentCommand("确认当前项目所有产品事实。");

    expect(parsed.operations).toContainEqual({
      type: "confirm_product_facts",
      value: {
        scope: "current_project",
      },
      label: "确认当前项目待复核产品事实",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts starter plan generation requests", () => {
    const parsed = parseAgentCommand("请生成首月计划和第一份素材包结构。");

    expect(parsed.operations).toContainEqual({
      type: "generate_starter_plan",
      value: "first_month",
      label: "生成首月计划和第一份素材包结构",
    });
  });

  it("extracts metrics snapshot creation requests", () => {
    const parsed = parseAgentCommand(
      "记录 2026-07 第3周 TikTok 曝光10000 点击600 转化24 花费1234.56 元。",
    );

    expect(parsed.operations).toContainEqual({
      type: "create_metrics_snapshot",
      value: {
        period: "2026-07 第3周",
        channel: "TikTok",
        impressions: 10000,
        clicks: 600,
        conversions: 24,
        spendCents: 123456,
        notes: "由 B 组 Agent 中文指令录入。",
      },
      label: "录入指标：2026-07 第3周 · TikTok · 曝光 10000 / 点击 600 / 转化 24 / 花费 ¥1234.56",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts metrics risk reminder generation requests", () => {
    const parsed = parseAgentCommand("把数据复盘风险生成提醒。");

    expect(parsed.operations).toContainEqual({
      type: "create_metrics_risk_reminders",
      value: {
        limit: 4,
      },
      label: "根据数据复盘风险生成提醒",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content plan item creation requests", () => {
    const parsed = parseAgentCommand(
      "第2周 TikTok 做一条开箱短视频，主题新品认知，交付短视频脚本，截止 2026-08-07，可执行。",
    );

    expect(parsed.operations).toContainEqual({
      type: "create_plan_item",
      value: {
        week: 2,
        channel: "TikTok",
        theme: "新品认知",
        title: "开箱短视频",
        deliverable: "短视频脚本",
        dueDate: "2026-08-07",
        status: PlanItemStatus.READY,
      },
      label: "新增内容计划：第2周 · TikTok · 开箱短视频",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content calendar gap reminder requests", () => {
    const parsed = parseAgentCommand("把内容日历缺口生成提醒。");

    expect(parsed.operations).toContainEqual({
      type: "create_calendar_gap_reminders",
      value: {
        limit: 4,
      },
      label: "根据内容日历缺口生成提醒",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content package creation requests for a specific period", () => {
    const parsed = parseAgentCommand("为 2026-08 第1周创建 TikTok 素材包。");

    expect(parsed.operations).toContainEqual({
      type: "create_content_package",
      value: {
        name: "2026-08 第1周 TikTok 素材包",
        period: "2026-08 第1周",
        frequency: ContentFrequency.WEEKLY,
        summary: "由 B 组 Agent 中文指令创建的素材包结构，待补充真实素材和审核。",
      },
      label: "创建素材包结构：2026-08 第1周 TikTok 素材包",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content package readiness reminder requests", () => {
    const parsed = parseAgentCommand("把最新素材包可交付性缺口生成提醒。");

    expect(parsed.operations).toContainEqual({
      type: "create_content_package_readiness_reminders",
      value: {
        limit: 4,
      },
      label: "根据素材包可交付性缺口生成提醒：最新素材包",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content package file status updates", () => {
    const parsed = parseAgentCommand("把最新素材包全部文件标记为已生成。");

    expect(parsed.operations).toContainEqual({
      type: "update_content_package_files_status",
      value: {
        status: PackageFileStatus.GENERATED,
      },
      label: "全部文件标记为已生成：最新素材包",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts poster asset attachment requests for content packages", () => {
    const parsed = parseAgentCommand("把最新模板海报关联到最新素材包。");

    expect(parsed.operations).toContainEqual({
      type: "attach_latest_poster_to_content_package",
      value: {},
      label: "关联模板海报到素材包：最新素材包",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content package review submission requests", () => {
    const parsed = parseAgentCommand("提交最新素材包审核。");

    expect(parsed.operations).toContainEqual({
      type: "submit_content_package_review",
      value: {},
      label: "提交素材包审核：最新素材包",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content package review decision requests", () => {
    const parsed = parseAgentCommand("最新素材包审核通过。");

    expect(parsed.operations).toContainEqual({
      type: "decide_content_package_review",
      value: {
        decision: ReviewTaskStatus.APPROVED,
        decisionNote: "由 B 组 Agent 中文指令处理。",
      },
      label: "审核通过：最新素材包",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts product fact review decisions without using the content package flow", () => {
    const parsed = parseAgentCommand("产品事实审核通过。");

    expect(parsed.operations).toEqual([
      {
        type: "decide_review_task",
        value: {
          subjectType: ReviewSubjectType.PRODUCT_FACT,
          decision: ReviewTaskStatus.APPROVED,
          decisionNote: "由 B 组 Agent 中文指令处理。",
        },
        label: "产品事实审核通过",
      },
    ]);
    expect(parsed.confidence).toBe("high");
  });

  it("extracts asset review change requests with a keyword", () => {
    const parsed = parseAgentCommand("Logo 素材审核不通过，要求修改。");

    expect(parsed.operations).toContainEqual({
      type: "decide_review_task",
      value: {
        subjectType: ReviewSubjectType.ASSET,
        decision: ReviewTaskStatus.CHANGES_REQUESTED,
        keyword: "Logo",
        decisionNote: "由 B 组 Agent 中文指令处理。",
      },
      label: "素材要求修改：Logo",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts missing review task generation requests", () => {
    const parsed = parseAgentCommand("补齐当前项目审核中心任务。");

    expect(parsed.operations).toContainEqual({
      type: "create_missing_review_tasks",
      value: {
        scope: "current_project",
      },
      label: "补齐当前项目审核任务",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts review task cancellation requests", () => {
    const parsed = parseAgentCommand("取消最新素材包审核任务。");

    expect(parsed.operations).toContainEqual({
      type: "cancel_review_task",
      value: {
        subjectType: ReviewSubjectType.CONTENT_PACKAGE,
        decisionNote: "由 B 组 Agent 中文指令取消。",
      },
      label: "取消素材包审核任务",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts reminder completion requests", () => {
    const parsed = parseAgentCommand("把抽奖规则提醒标记完成。");

    expect(parsed.operations).toContainEqual({
      type: "complete_reminder",
      value: {
        keyword: "抽奖规则",
      },
      label: "完成提醒：抽奖规则",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts reminder dismissal requests", () => {
    const parsed = parseAgentCommand("忽略抽奖规则提醒。");

    expect(parsed.operations).toEqual([
      {
        type: "dismiss_reminder",
        value: {
          keyword: "抽奖规则",
        },
        label: "忽略提醒：抽奖规则",
      },
    ]);
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content plan completion requests", () => {
    const parsed = parseAgentCommand("第2周 TikTok 开箱短视频已完成。");

    expect(parsed.operations).toContainEqual({
      type: "complete_plan_item",
      value: {
        week: 2,
        channel: "TikTok",
        keyword: "开箱",
      },
      label: "完成内容计划：第2周 · TikTok · 开箱",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content plan status update requests", () => {
    const parsed = parseAgentCommand("第2周 TikTok 开箱短视频标记为需审核。");

    expect(parsed.operations).toContainEqual({
      type: "update_plan_item_status",
      value: {
        week: 2,
        channel: "TikTok",
        keyword: "开箱",
        status: PlanItemStatus.REVIEW_NEEDED,
      },
      label: "内容计划改为需审核：第2周 · TikTok · 开箱",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("extracts content plan due date update requests", () => {
    const parsed = parseAgentCommand("第2周 TikTok 开箱短视频截止日期改到 2026-08-10。");

    expect(parsed.operations).toContainEqual({
      type: "update_plan_item_due_date",
      value: {
        week: 2,
        channel: "TikTok",
        keyword: "开箱",
        dueDate: "2026-08-10",
      },
      label: "内容计划截止日期改为 2026-08-10：第2周 · TikTok · 开箱",
    });
    expect(parsed.confidence).toBe("high");
  });

  it("returns a low-confidence summary when no safe operation is detected", () => {
    const parsed = parseAgentCommand("帮我看看这个项目怎么样");

    expect(parsed.operations).toHaveLength(0);
    expect(parsed.confidence).toBe("low");
    expect(parsed.summary).toContain("还没有识别到");
  });
});
