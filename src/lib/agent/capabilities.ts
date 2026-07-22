export type AgentCapabilityCategory =
  | "strategy"
  | "product_brain"
  | "planning"
  | "content_package"
  | "review"
  | "reminder"
  | "recap";

export type AgentCommandCapability = {
  key: string;
  category: AgentCapabilityCategory;
  title: string;
  example: string;
  writesTo: string[];
  requiresExplicitHumanReview: boolean;
};

export const agentCommandCapabilities: AgentCommandCapability[] = [
  {
    key: "strategy_channels",
    category: "strategy",
    title: "新增或删除渠道",
    example: "巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。",
    writesTo: ["ProjectStrategy", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "strategy_recommendation",
    category: "strategy",
    title: "根据产品事实推荐策略",
    example: "请根据产品事实推荐一版巴西首月增长策略。",
    writesTo: ["ProjectStrategy", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "strategy_audiences",
    category: "strategy",
    title: "新增或删除客群",
    example: "不要学生用户，新增礼品购买者，本月不做小抽奖。",
    writesTo: ["ProjectStrategy", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "project_status",
    category: "strategy",
    title: "修改项目状态",
    example: "暂停这个项目，新增 TikTok。",
    writesTo: ["Project", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "product_fact_create",
    category: "product_brain",
    title: "补充产品事实",
    example: "新增产品事实：卖点=24小时保温。",
    writesTo: ["ProductFact", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "product_fact_infer_text",
    category: "product_brain",
    title: "从中文资料提取产品事实",
    example:
      "请从产品资料提取产品事实：智能温显保温杯，500ml，不锈钢，适合通勤和健身，24小时保温。",
    writesTo: ["ProductFact", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "product_fact_confirm",
    category: "product_brain",
    title: "确认当前项目产品事实",
    example: "确认当前项目所有产品事实。",
    writesTo: ["ProductFact", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "reminder_create",
    category: "reminder",
    title: "创建项目提醒",
    example: "提醒我 2026-08-07 前确认巴西抽奖奖品和活动规则。",
    writesTo: ["Reminder", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "project_health_reminders",
    category: "reminder",
    title: "将项目体检缺口生成提醒",
    example: "把项目体检缺口生成提醒。",
    writesTo: ["Reminder", "Project", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "reminder_complete",
    category: "reminder",
    title: "完成项目提醒",
    example: "把抽奖规则提醒标记完成。",
    writesTo: ["Reminder", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "reminder_dismiss",
    category: "reminder",
    title: "忽略项目提醒",
    example: "忽略抽奖规则提醒。",
    writesTo: ["Reminder", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "metrics_create",
    category: "recap",
    title: "录入渠道表现",
    example: "记录 2026-07 第3周 TikTok 曝光10000 点击600 转化24 花费1234.56 元。",
    writesTo: ["MetricsSnapshot", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "metrics_risk_reminders",
    category: "recap",
    title: "将复盘风险生成提醒",
    example: "把数据复盘风险生成提醒。",
    writesTo: ["MetricsSnapshot", "Reminder", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "plan_item_create",
    category: "planning",
    title: "新增内容计划",
    example: "第2周 TikTok 做一条开箱短视频，主题新品认知，交付短视频脚本，截止 2026-08-07，可执行。",
    writesTo: ["ContentPlanItem", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "plan_item_complete",
    category: "planning",
    title: "完成内容计划",
    example: "第2周 TikTok 开箱短视频已完成。",
    writesTo: ["ContentPlanItem", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "plan_item_status",
    category: "planning",
    title: "更新内容计划状态",
    example: "第2周 TikTok 开箱短视频标记为需审核。",
    writesTo: ["ContentPlanItem", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "calendar_gap_reminders",
    category: "planning",
    title: "将内容日历缺口生成提醒",
    example: "把内容日历缺口生成提醒。",
    writesTo: ["ContentPlanItem", "Reminder", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "content_package_create",
    category: "content_package",
    title: "创建素材包结构",
    example: "为 2026-08 第1周创建 TikTok 素材包。",
    writesTo: ["ContentPackage", "ContentPackageFile", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "content_package_readiness_reminders",
    category: "content_package",
    title: "将素材包交付缺口生成提醒",
    example: "把最新素材包可交付性缺口生成提醒。",
    writesTo: ["Reminder", "ContentPackage", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "content_package_files_status",
    category: "content_package",
    title: "批量推进素材包文件状态",
    example: "把最新素材包全部文件标记为已生成。",
    writesTo: ["ContentPackageFile", "ContentPackage", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "content_package_attach_poster",
    category: "content_package",
    title: "关联模板海报到素材包",
    example: "把最新模板海报关联到最新素材包。",
    writesTo: ["ContentPackageFile", "Asset", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "content_package_submit_review",
    category: "review",
    title: "提交素材包审核",
    example: "提交最新素材包审核。",
    writesTo: ["ContentPackage", "ReviewTask", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "content_package_decide_review",
    category: "review",
    title: "处理素材包审核",
    example: "最新素材包审核通过，或最新素材包要求修改。",
    writesTo: ["ContentPackage", "ReviewTask", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "review_task_decide",
    category: "review",
    title: "处理审核中心任务",
    example: "产品事实审核通过，或 Logo 素材审核不通过，要求修改。",
    writesTo: ["ReviewTask", "ProductFact", "Asset", "ProjectStrategy", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "review_task_cancel",
    category: "review",
    title: "取消审核中心任务",
    example: "取消最新素材包审核任务。",
    writesTo: ["ReviewTask", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
  {
    key: "review_tasks_create_missing",
    category: "review",
    title: "补齐当前项目审核任务",
    example: "补齐当前项目审核中心任务。",
    writesTo: ["ReviewTask", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "starter_plan",
    category: "planning",
    title: "生成首月计划",
    example: "请生成首月计划和第一份素材包结构。",
    writesTo: ["ContentPlanItem", "ContentPackage", "ContentPackageFile", "Reminder", "ChangeLog"],
    requiresExplicitHumanReview: false,
  },
  {
    key: "market_detection",
    category: "strategy",
    title: "识别目标市场",
    example: "蒙古市场先做 Facebook 和 Instagram。",
    writesTo: ["ProjectStrategy", "AgentOperation", "ChangeLog"],
    requiresExplicitHumanReview: true,
  },
];

export function getAgentCommandCapabilitiesByCategory(category: AgentCapabilityCategory) {
  return agentCommandCapabilities.filter((capability) => capability.category === category);
}
