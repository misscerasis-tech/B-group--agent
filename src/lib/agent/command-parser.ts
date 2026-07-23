import {
  ContentFrequency,
  ContentPackageStatus,
  PackageFileStatus,
  PlanItemStatus,
  ProjectStatus,
  ReminderSeverity,
  ReviewSubjectType,
  ReviewTaskStatus,
} from "@prisma/client";
import { parseContentPlanImportRows } from "@/lib/content-plan/importer";
import { parseMetricsImportRows } from "@/lib/metrics/importer";

export type ParsedAgentOperation =
  | {
      type:
        | "add_channel"
        | "remove_channel"
        | "set_market"
        | "add_audience"
        | "remove_audience"
        | "add_content_direction"
        | "remove_content_direction";
      value: string;
      label: string;
    }
  | {
      type: "set_package_frequency";
      value: ContentFrequency;
      label: string;
    }
  | {
      type: "set_project_status";
      value: ProjectStatus;
      label: string;
    }
  | {
      type: "kickoff_project";
      value: {
        projectName: string;
        productName: string;
        brief: string;
        targetMarkets: string[];
        audiences: string[];
        channels: string[];
        contentDirections: string[];
        packageFrequency: ContentFrequency;
      };
      label: string;
    }
  | {
      type: "switch_project";
      value: {
        keyword: string;
      };
      label: string;
    }
  | {
      type: "summarize_project";
      value: {
        scope: "current_project";
      };
      label: string;
    }
  | {
      type: "recommend_strategy";
      value: {
        basis: "product_facts";
        contextText?: string;
      };
      label: string;
    }
  | {
      type: "confirm_project_strategy";
      value: {
        scope: "current_project";
      };
      label: string;
    }
  | {
      type: "create_reminder";
      value: string;
      label: string;
      severity: ReminderSeverity;
      dueAt?: string;
    }
  | {
      type: "create_project_health_reminders";
      value: {
        limit: number;
      };
      label: string;
    }
  | {
      type: "create_product_fact";
      value: {
        label: string;
        value: string;
        source: string;
      };
      label: string;
    }
  | {
      type: "create_product";
      value: {
        name: string;
        description: string;
      };
      label: string;
    }
  | {
      type: "update_product_fact";
      value: {
        label: string;
        value: string;
        source: string;
      };
      label: string;
    }
  | {
      type: "infer_product_facts_from_text";
      value: {
        sourceText: string;
        source: string;
      };
      label: string;
    }
  | {
      type: "confirm_product_facts";
      value: {
        scope: "current_project";
      };
      label: string;
    }
  | {
      type: "complete_reminder";
      value: {
        keyword: string;
      };
      label: string;
    }
  | {
      type: "dismiss_reminder";
      value: {
        keyword: string;
      };
      label: string;
    }
  | {
      type: "update_reminder_due_date";
      value: {
        keyword: string;
        dueAt: string;
      };
      label: string;
    }
  | {
      type: "create_metrics_snapshot";
      value: {
        period: string;
        channel: string;
        impressions: number;
        clicks: number;
        conversions: number;
        spendCents: number;
        notes?: string;
      };
      label: string;
    }
  | {
      type: "import_metrics_snapshots";
      value: {
        rows: Array<{
          period: string;
          channel: string;
          impressions: number;
          clicks: number;
          conversions: number;
          spendCents: number;
          notes?: string;
        }>;
        source: "agent_paste";
      };
      label: string;
    }
  | {
      type: "create_metrics_risk_reminders";
      value: {
        limit: number;
      };
      label: string;
    }
  | {
      type: "create_plan_item";
      value: {
        week: number;
        channel: string;
        theme: string;
        title: string;
        deliverable: string;
        dueDate?: string;
        status: PlanItemStatus;
      };
      label: string;
    }
  | {
      type: "import_plan_items";
      value: {
        rows: Array<{
          week: number;
          channel: string;
          theme: string;
          title: string;
          deliverable: string;
          dueDate?: string;
          status: PlanItemStatus;
        }>;
        source: "agent_paste";
      };
      label: string;
    }
  | {
      type: "update_plan_item_status";
      value: {
        status: PlanItemStatus;
        keyword?: string;
        week?: number;
        channel?: string;
      };
      label: string;
    }
  | {
      type: "update_plan_item_due_date";
      value: {
        dueDate: string;
        keyword?: string;
        week?: number;
        channel?: string;
      };
      label: string;
    }
  | {
      type: "create_calendar_gap_reminders";
      value: {
        limit: number;
      };
      label: string;
    }
  | {
      type: "create_content_package";
      value: {
        name: string;
        period: string;
        frequency: ContentFrequency;
        summary?: string;
      };
      label: string;
    }
  | {
      type: "update_content_package_status";
      value: {
        status: typeof ContentPackageStatus.ARCHIVED | typeof ContentPackageStatus.DRAFT;
        keyword?: string;
      };
      label: string;
    }
  | {
      type: "create_content_package_readiness_reminders";
      value: {
        keyword?: string;
        limit: number;
      };
      label: string;
    }
  | {
      type: "update_content_package_files_status";
      value: {
        keyword?: string;
        status: typeof PackageFileStatus.GENERATED | typeof PackageFileStatus.APPROVED;
      };
      label: string;
    }
  | {
      type: "attach_latest_poster_to_content_package";
      value: {
        packageKeyword?: string;
        assetKeyword?: string;
      };
      label: string;
    }
  | {
      type: "submit_content_package_review";
      value: {
        keyword?: string;
      };
      label: string;
    }
  | {
      type: "decide_content_package_review";
      value: {
        decision: typeof ReviewTaskStatus.APPROVED | typeof ReviewTaskStatus.CHANGES_REQUESTED;
        keyword?: string;
        decisionNote: string;
      };
      label: string;
    }
  | {
      type: "decide_review_task";
      value: {
        subjectType?: ReviewSubjectType;
        decision: typeof ReviewTaskStatus.APPROVED | typeof ReviewTaskStatus.CHANGES_REQUESTED;
        keyword?: string;
        decisionNote: string;
      };
      label: string;
    }
  | {
      type: "cancel_review_task";
      value: {
        subjectType?: ReviewSubjectType;
        keyword?: string;
        decisionNote: string;
      };
      label: string;
    }
  | {
      type: "create_missing_review_tasks";
      value: {
        scope: "current_project";
      };
      label: string;
    }
  | {
      type: "complete_plan_item";
      value: {
        keyword?: string;
        week?: number;
        channel?: string;
      };
      label: string;
    }
  | {
      type: "generate_starter_plan";
      value: "first_month";
      label: string;
    };

export type ParsedAgentCommand = {
  rawText: string;
  operations: ParsedAgentOperation[];
  summary: string;
  confidence: "high" | "medium" | "low";
};

const CHANNELS = [
  "TikTok",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "YouTube",
  "X",
  "Twitter",
  "Pinterest",
  "Shopee",
  "Lazada",
  "Amazon",
  "小红书",
  "抖音",
  "视频号",
  "WhatsApp",
];

const MARKET_ALIASES: Array<[string, string[]]> = [
  ["巴西", ["巴西", "Brazil"]],
  ["蒙古", ["蒙古", "Mongolia"]],
  ["美国", ["美国", "USA", "US", "America"]],
  ["日本", ["日本", "Japan"]],
  ["韩国", ["韩国", "Korea"]],
  ["东南亚", ["东南亚", "Southeast Asia"]],
  ["墨西哥", ["墨西哥", "Mexico"]],
  ["德国", ["德国", "Germany"]],
];

const AUDIENCE_HINTS = [
  "年轻通勤人群",
  "通勤人群",
  "健身用户",
  "户外用户",
  "礼品购买者",
  "学生用户",
  "办公人群",
  "居家办公人群",
  "桌面美学爱好者",
];

const DIRECTION_HINTS = [
  "世界杯",
  "那达慕",
  "圣诞",
  "黑五",
  "返校季",
  "通勤",
  "健身",
  "礼赠",
  "小抽奖",
  "抽奖活动",
  "桌面改造",
  "护眼学习",
  "节能生活",
];

const PRODUCT_FACT_LABELS: Record<string, string> = {
  产品名称: "产品名称",
  名称: "产品名称",
  核心卖点: "核心卖点",
  卖点: "核心卖点",
  规格参数: "规格参数",
  产品参数: "规格参数",
  规格: "规格参数",
  参数: "规格参数",
  容量: "规格参数",
  材质: "规格参数",
  尺寸: "规格参数",
  使用场景: "使用场景",
  场景: "使用场景",
  目标人群: "目标人群",
  人群: "目标人群",
  视觉限制: "视觉限制",
  合规注意: "合规注意",
  合规: "合规注意",
};

const PRODUCT_FACT_LABEL_PATTERN =
  "(产品名称|名称|核心卖点|卖点|规格参数|产品参数|规格|参数|容量|材质|尺寸|使用场景|场景|目标人群|人群|视觉限制|合规注意|合规)";

const MAX_PRODUCT_FACT_SOURCE_TEXT_LENGTH = 2000;

function compactText(text: string) {
  return text.replace(/\s+/g, "");
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function hasRemoveIntent(text: string, channel: string) {
  const compact = compactText(text).toLowerCase();
  const normalizedChannel = compactText(channel).toLowerCase();

  return [
    `不做${normalizedChannel}`,
    `不要${normalizedChannel}`,
    `删除${normalizedChannel}`,
    `去掉${normalizedChannel}`,
    `移除${normalizedChannel}`,
    `取消${normalizedChannel}`,
  ].some((pattern) => compact.includes(pattern));
}

function hasAddIntent(text: string, channel: string) {
  const compact = compactText(text).toLowerCase();
  const normalizedChannel = compactText(channel).toLowerCase();

  if (hasRemoveIntent(text, channel)) {
    return false;
  }

  return [
    `新增${normalizedChannel}`,
    `增加${normalizedChannel}`,
    `加入${normalizedChannel}`,
    `加上${normalizedChannel}`,
    `补充${normalizedChannel}`,
    `改做${normalizedChannel}`,
    `做${normalizedChannel}`,
  ].some((pattern) => compact.includes(pattern));
}

function parseFrequency(text: string): ContentFrequency | null {
  if (/每周|一周一次|周更|weekly/i.test(text)) {
    return ContentFrequency.WEEKLY;
  }

  if (/每两周|两周一次|双周|biweekly/i.test(text)) {
    return ContentFrequency.BIWEEKLY;
  }

  if (/每月|每个月|一个月一次|月更|monthly/i.test(text)) {
    return ContentFrequency.MONTHLY;
  }

  return null;
}

function parseProjectKickoffOperation(text: string): ParsedAgentOperation | null {
  if (!hasProjectKickoffIntent(text)) {
    return null;
  }

  const explicitProductName = extractProjectKickoffProductName(text);
  const projectName = extractProjectKickoffProjectName(text, explicitProductName);
  const productName = explicitProductName ?? inferProductNameFromProjectName(projectName);

  if (!projectName || !productName) {
    return null;
  }

  const targetMarkets = findMentionedMarkets(text);
  const addedChannels = CHANNELS.filter(
    (channel) => hasAddIntent(text, channel) || mentionsChannel(text, channel),
  );
  const removedChannels = CHANNELS.filter((channel) => hasRemoveIntent(text, channel));
  const audiences = AUDIENCE_HINTS.filter(
    (audience) => text.includes(audience) && !hasRemoveIntent(text, audience),
  );
  const contentDirections = DIRECTION_HINTS.filter(
    (direction) => text.includes(direction) && !hasRemoveIntent(text, direction),
  );
  const channels = unique([
    ...recommendChannelsForMarkets(targetMarkets),
    ...addedChannels,
  ]).filter((channel) => !removedChannels.includes(channel));

  return {
    type: "kickoff_project",
    value: {
      projectName,
      productName,
      brief: text.slice(0, MAX_PRODUCT_FACT_SOURCE_TEXT_LENGTH),
      targetMarkets: targetMarkets.length > 0 ? targetMarkets : ["待确认市场"],
      audiences: audiences.length > 0 ? audiences : ["目标客群待确认"],
      channels: channels.length > 0 ? channels : ["TikTok", "Instagram"],
      contentDirections:
        contentDirections.length > 0 ? contentDirections : ["新品认知", "场景种草", "转化促销"],
      packageFrequency: parseFrequency(text) ?? ContentFrequency.MONTHLY,
    },
    label: `启动新项目：${projectName}`,
  };
}

function parseCreateProductOperation(text: string): ParsedAgentOperation | null {
  if (!hasProductCreationIntent(text)) {
    return null;
  }

  const name = extractProductCreationName(text);

  if (!name) {
    return null;
  }

  return {
    type: "create_product",
    value: {
      name,
      description: text.slice(0, MAX_PRODUCT_FACT_SOURCE_TEXT_LENGTH),
    },
    label: `新增并关联产品：${name}`,
  };
}

function hasProductCreationIntent(text: string) {
  const compact = compactText(text);

  if (/产品事实|事实确认|事实提取|提取产品/.test(compact)) {
    return false;
  }

  return /(新增|创建|添加|加入|补充).*(产品|新品|商品|SKU|sku)/.test(text);
}

function extractProductCreationName(text: string) {
  const explicit = text.match(/(?:产品|新品|商品|SKU|sku)(?:名称|名)?[：:]\s*([^，。；;\n]+)/)?.[1];

  if (explicit) {
    return cleanProductKickoffName(explicit);
  }

  const described = text.match(
    /(?:新增|创建|添加|加入|补充)(?:一个|1个)?(?:产品|新品|商品|SKU|sku)(?:是|为|叫)\s*([^，。；;\n]+)/,
  )?.[1];

  if (described) {
    return cleanProductKickoffName(described);
  }

  const beforeProduct = text.match(
    /(?:新增|创建|添加|加入|补充)(?:一个|1个)?\s*([^，。；;\n]{2,50}?)(?:产品|新品|商品)/,
  )?.[1];

  return beforeProduct ? cleanProductKickoffName(beforeProduct) : null;
}

function parseProjectSwitchOperation(text: string): ParsedAgentOperation | null {
  const compact = compactText(text);

  if (/项目中心|新项目|新建|创建|启动|发起|新增/.test(compact)) {
    return null;
  }

  if (!/(切换到|切到|切换|打开|进入|查看|跳到|转到).*(项目|工作台)/.test(text)) {
    return null;
  }

  const keyword = extractProjectSwitchKeyword(text);

  if (!keyword) {
    return null;
  }

  return {
    type: "switch_project",
    value: {
      keyword,
    },
    label: `切换项目：${keyword}`,
  };
}

function extractProjectSwitchKeyword(text: string) {
  const match = text.match(/(?:切换到|切到|切换|打开|进入|查看|跳到|转到)\s*([^，。；;\n]+)/)?.[1];

  if (!match) {
    return null;
  }

  const keyword = match
    .replace(/^(一下|下|当前|这个|那个)/, "")
    .replace(/(项目工作台|工作台|项目|页面|详情)$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : null;
}

function parseProjectSummaryOperation(text: string): ParsedAgentOperation | null {
  if (!/(项目|进展|状态|风险|下一步|今天|工作台)/.test(text)) {
    return null;
  }

  if (!/(总结|概览|简报|看看|诊断|体检|怎么样|下一步|今天.*做|该做什么|要做什么)/.test(text)) {
    return null;
  }

  return {
    type: "summarize_project",
    value: {
      scope: "current_project",
    },
    label: "总结当前项目状态和下一步",
  };
}

function hasProjectKickoffIntent(text: string) {
  const compact = compactText(text);

  if (/提醒|待办|审核任务|体检|缺口|归档|恢复/.test(compact)) {
    return false;
  }

  return (
    /(创建|新建|启动|发起|开一个|开设).*(项目|增长项目|Campaign|campaign)/.test(text) &&
    /(产品|新品|商品|SKU|sku)/.test(text)
  );
}

function extractProjectKickoffProjectName(text: string, productName?: string | null) {
  const explicit = text.match(/项目(?:名称|名)?[：:]\s*([^，。；;\n]+)/)?.[1]?.trim();

  if (explicit) {
    return cleanProjectKickoffName(explicit);
  }

  const actionBased = text.match(
    /(?:创建|新建|启动|发起|开一个|开设)(?:一个|1个)?\s*([^，。；;\n]{2,50}?项目)/,
  )?.[1];

  if (actionBased && !/^(新项目|一个项目|项目)$/.test(actionBased.trim())) {
    return cleanProjectKickoffName(actionBased);
  }

  const market = findMentionedMarkets(text)[0] ?? "新品";
  const product = productName ?? "待命名产品";
  return `${market}${product}内容增长`;
}

function cleanProjectKickoffName(value: string) {
  return value.replace(/^(一个|1个)/, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function extractProjectKickoffProductName(text: string) {
  const explicit = text.match(/产品(?:名称|名)?[：:]\s*([^，。；;\n]+)/)?.[1]?.trim();

  if (explicit) {
    return cleanProductKickoffName(explicit);
  }

  const described = text.match(
    /(?:产品|新品|商品|SKU|sku)(?:名称是|名称为|是|为|叫|：|:)\s*([^，。；;\n]+)/,
  )?.[1]?.trim();

  return described ? cleanProductKickoffName(described) : null;
}

function cleanProductKickoffName(value: string) {
  return value.replace(/\s+/g, " ").replace(/^(一款|一个|1个)/, "").trim().slice(0, 80);
}

function inferProductNameFromProjectName(projectName: string) {
  let candidate = projectName
    .replace(/项目/g, "")
    .replace(/内容增长|增长|Campaign|campaign|首月|上市|推广|新品/g, "");

  for (const [market, aliases] of MARKET_ALIASES) {
    candidate = candidate.replace(market, "");
    for (const alias of aliases) {
      candidate = candidate.replace(alias, "");
    }
  }

  candidate = candidate.trim();
  return candidate.length >= 2 ? candidate.slice(0, 80) : null;
}

function findMentionedMarkets(text: string) {
  return MARKET_ALIASES.filter(([, aliases]) => includesAny(text, aliases)).map(
    ([market]) => market,
  );
}

function mentionsChannel(text: string, channel: string) {
  return text.toLowerCase().includes(channel.toLowerCase());
}

function recommendChannelsForMarkets(targetMarkets: string[]) {
  if (targetMarkets.includes("巴西")) {
    return ["TikTok", "Instagram", "Facebook"];
  }

  if (targetMarkets.includes("蒙古")) {
    return ["Facebook", "Instagram"];
  }

  if (targetMarkets.includes("日本")) {
    return ["Instagram", "TikTok", "X"];
  }

  if (targetMarkets.includes("美国")) {
    return ["TikTok", "Instagram", "YouTube"];
  }

  return [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseProjectStatus(text: string): ProjectStatus | null {
  const compact = compactText(text);

  if (/归档项目|项目归档|结束项目|关闭项目/.test(compact)) {
    return ProjectStatus.ARCHIVED;
  }

  if (/暂停项目|项目暂停|暂停这个项目|当前项目暂停|暂缓项目|暂停投放/.test(compact)) {
    return ProjectStatus.PAUSED;
  }

  if (/启动项目|恢复项目|重启项目|继续推进|继续这个项目|开始执行/.test(compact)) {
    return ProjectStatus.ACTIVE;
  }

  if (/项目草稿|改回草稿|暂存草稿/.test(compact)) {
    return ProjectStatus.DRAFT;
  }

  return null;
}

function parseStrategyRecommendationOperation(text: string): ParsedAgentOperation | null {
  if (
    !(
      /(推荐|生成|制定|输出).*(增长策略|项目策略|内容策略|市场策略|策略推荐)/.test(text) ||
      /推荐.*(市场|客群|渠道|平台|内容方向)/.test(text)
    )
  ) {
    return null;
  }

  return {
    type: "recommend_strategy",
    value: {
      basis: "product_facts",
      contextText: text.slice(0, 500),
    },
    label: "根据产品事实生成策略推荐草案",
  };
}

function parseProjectStrategyConfirmationOperation(text: string): ParsedAgentOperation | null {
  if (/产品事实|素材包|审核任务/.test(text)) {
    return null;
  }

  if (!/(确认|通过|批准|设为|转为).*(正式策略|当前策略|策略草案|项目策略|市场策略)/.test(text)) {
    return null;
  }

  return {
    type: "confirm_project_strategy",
    value: {
      scope: "current_project",
    },
    label: "确认当前策略为正式策略",
  };
}

function parseReminderSeverity(text: string): ReminderSeverity {
  if (/紧急|马上|立刻|必须|critical/i.test(text)) {
    return ReminderSeverity.CRITICAL;
  }

  if (/风险|重要|提前|warning/i.test(text)) {
    return ReminderSeverity.WARNING;
  }

  return ReminderSeverity.INFO;
}

function parseReminderTitle(text: string) {
  if (!/(提醒我|帮我提醒|记得|待办|需要提醒)/.test(text)) {
    return null;
  }

  const title = text
    .replace(/请|麻烦|帮我/g, "")
    .replace(/提醒我|提醒|记得|待办|需要提醒/g, "")
    .replace(/，|。|！|!/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length < 4) {
    return "跟进当前项目待办";
  }

  return title.slice(0, 80);
}

function hasLeadingReminderIntent(text: string) {
  return /^(请|麻烦|帮我)?\s*(提醒我|帮我提醒|记得|待办|需要提醒)/.test(text);
}

function parseReminderOperation(text: string): ParsedAgentOperation | null {
  const reminderTitle = parseReminderTitle(text);

  if (!reminderTitle) {
    return null;
  }

  const severity = parseReminderSeverity(text);
  const dueAt = parseReminderDueDate(text);
  const severityLabel: Record<ReminderSeverity, string> = {
    INFO: "提示",
    WARNING: "风险",
    CRITICAL: "紧急",
  };

  return {
    type: "create_reminder",
    value: reminderTitle,
    severity,
    ...(dueAt ? { dueAt } : {}),
    label: `创建${severityLabel[severity]}提醒：${reminderTitle}`,
  };
}

function parseReminderDueDate(text: string) {
  const isoDate = text.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/);

  if (isoDate?.[0]) {
    return normalizeDateText(isoDate[0]);
  }

  const zhDate = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日?/);

  if (zhDate?.[1] && zhDate[2] && zhDate[3]) {
    return `${zhDate[1]}-${zhDate[2].padStart(2, "0")}-${zhDate[3].padStart(2, "0")}`;
  }

  return undefined;
}

function parseProjectHealthReminderOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(项目体检|体检缺口|项目缺口|就绪度|健康检查)/.test(text) ||
    !/(生成|创建|加入|转成|变成).*(提醒|待办)/.test(text)
  ) {
    return null;
  }

  return {
    type: "create_project_health_reminders",
    value: {
      limit: 4,
    },
    label: "根据项目体检缺口生成提醒",
  };
}

function parseProductFactOperation(text: string): ParsedAgentOperation | null {
  if (!/(产品事实|事实|卖点|规格|参数|场景|人群|视觉限制|合规)/.test(text)) {
    return null;
  }

  if (/(修改|更新|调整|更正|纠正|改成|改为|更新为|调整为)/.test(text)) {
    return null;
  }

  const match = text.match(
    new RegExp(
      `(?:新增|添加|记录|补充)?(?:产品事实|事实)?\\s*[:：]?\\s*${PRODUCT_FACT_LABEL_PATTERN}\\s*[=＝:：]\\s*([^，。；;]+)`,
    ),
  );

  if (!match?.[1] || !match[2]) {
    return null;
  }

  const label = PRODUCT_FACT_LABELS[match[1]] ?? match[1];
  const factValue = match[2].trim().slice(0, 160);

  if (factValue.length < 2) {
    return null;
  }

  return {
    type: "create_product_fact",
    value: {
      label,
      value: factValue,
      source: "B组 Agent 中文指令",
    },
    label: `新增产品事实：${label}=${factValue}`,
  };
}

function parseUpdateProductFactOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(产品事实|事实|卖点|规格|参数|容量|材质|尺寸|场景|人群|视觉限制|合规)/.test(text) ||
    !/(修改|更新|调整|更正|纠正|改成|改为|更新为|调整为)/.test(text)
  ) {
    return null;
  }

  const patterns = [
    new RegExp(
      `(?:修改|更新|调整|更正|纠正)(?:产品事实|事实)?\\s*[:：]?\\s*${PRODUCT_FACT_LABEL_PATTERN}\\s*[=＝:：]\\s*([^，。；;]+)`,
    ),
    new RegExp(
      `(?:把|将)?(?:产品事实|事实)?\\s*${PRODUCT_FACT_LABEL_PATTERN}\\s*(?:改成|改为|更新为|调整为|更正为)\\s*([^，。；;]+)`,
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match?.[1] || !match[2]) {
      continue;
    }

    const label = PRODUCT_FACT_LABELS[match[1]] ?? match[1];
    const factValue = match[2].trim().slice(0, 160);

    if (factValue.length < 2) {
      return null;
    }

    return {
      type: "update_product_fact",
      value: {
        label,
        value: factValue,
        source: "B组 Agent 中文指令校准",
      },
      label: `修改产品事实：${label}=${factValue}`,
    };
  }

  return null;
}

function parseInferProductFactsFromTextOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(产品资料|产品介绍|官方资料|产品brief|brief|Brief)/.test(text) ||
    !/(提取|抽取|整理|生成|识别).*(产品事实|事实)/.test(text)
  ) {
    return null;
  }

  const sourceText = extractProductFactSourceText(text);

  if (!sourceText || sourceText.length < 8) {
    return null;
  }

  const truncatedSourceText = sourceText.slice(0, MAX_PRODUCT_FACT_SOURCE_TEXT_LENGTH);
  const preview =
    truncatedSourceText.length > 42
      ? `${truncatedSourceText.slice(0, 42)}...`
      : truncatedSourceText;

  return {
    type: "infer_product_facts_from_text",
    value: {
      sourceText: truncatedSourceText,
      source: "B组 Agent 中文资料提取",
    },
    label: `从产品资料提取事实：${preview}`,
  };
}

function parseConfirmProductFactsOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(产品事实|事实)/.test(text) ||
    !/(确认|审核通过|通过审核|批准|全部通过|全部确认)/.test(text) ||
    /(新增|添加|记录|补充|提取|抽取|整理|生成|识别|审核)/.test(text)
  ) {
    return null;
  }

  return {
    type: "confirm_product_facts",
    value: {
      scope: "current_project",
    },
    label: "确认当前项目待复核产品事实",
  };
}

function extractProductFactSourceText(text: string) {
  const afterDelimiter = text.match(
    /(?:产品资料|产品介绍|官方资料|产品brief|brief|Brief)\s*[:：]\s*([\s\S]+)/,
  );

  if (afterDelimiter?.[1]) {
    return cleanProductFactSourceText(afterDelimiter[1]);
  }

  const afterActionDelimiter = text.match(
    /(?:提取|抽取|整理|生成|识别)(?:产品事实|事实)\s*[:：]\s*([\s\S]+)/,
  );

  if (afterActionDelimiter?.[1]) {
    return cleanProductFactSourceText(afterActionDelimiter[1]);
  }

  const beforeAction = text.match(
    /(?:从|根据)\s*([\s\S]{8,})\s*(?:提取|抽取|整理|生成|识别)(?:产品事实|事实)/,
  );

  if (beforeAction?.[1]) {
    return cleanProductFactSourceText(beforeAction[1]);
  }

  return null;
}

function cleanProductFactSourceText(value: string) {
  return value
    .replace(/请|麻烦|帮我/g, "")
    .replace(/提取|抽取|整理|生成|识别/g, "")
    .replace(/产品事实|事实/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[：:，,。；;\s]+/, "")
    .trim();
}

function parseCompleteReminderOperation(text: string): ParsedAgentOperation | null {
  if (!/(提醒|待办)/.test(text) || !hasCompletionIntent(text)) {
    return null;
  }

  const keyword = extractCompletionKeyword(text, ["提醒", "待办"]);

  if (!keyword) {
    return null;
  }

  return {
    type: "complete_reminder",
    value: {
      keyword,
    },
    label: `完成提醒：${keyword}`,
  };
}

function parseDismissReminderOperation(text: string): ParsedAgentOperation | null {
  if (!/(提醒|待办)/.test(text) || !hasDismissIntent(text)) {
    return null;
  }

  const keyword = extractDismissKeyword(text);

  if (!keyword) {
    return null;
  }

  return {
    type: "dismiss_reminder",
    value: {
      keyword,
    },
    label: `忽略提醒：${keyword}`,
  };
}

function parseReminderDueDateUpdateOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(提醒|待办)/.test(text) ||
    !/(截止|到期|日期|时间|due)/i.test(text) ||
    !/(改到|改为|改成|调整到|调整为|设为|定在|延后到|提前到|截止到|截止至)/.test(text)
  ) {
    return null;
  }

  const dueAt = parseReminderDueDate(text);

  if (!dueAt) {
    return null;
  }

  const keyword = extractReminderDueDateKeyword(text);

  if (!keyword) {
    return null;
  }

  return {
    type: "update_reminder_due_date",
    value: {
      keyword,
      dueAt,
    },
    label: `提醒截止日期改为 ${dueAt}：${keyword}`,
  };
}

function hasDismissIntent(text: string) {
  return /忽略|取消提醒|取消待办|不需要提醒|无需提醒|dismiss/i.test(text);
}

function hasLeadingDismissReminderIntent(text: string) {
  return /^(请|麻烦|帮我)?\s*(忽略|取消|不需要|无需).*(提醒|待办)/.test(text);
}

function extractReminderDueDateKeyword(text: string) {
  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|这个项目|项目/g, "")
    .replace(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/g, "")
    .replace(/20\d{2}年\d{1,2}月\d{1,2}日?/g, "")
    .replace(/截止日期|截止时间|到期日期|到期时间|截止|到期|日期|时间|due/gi, "")
    .replace(/改到|改为|改成|调整到|调整为|设为|定在|延后到|提前到|截止到|截止至/g, "")
    .replace(/提醒|待办/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : null;
}

function extractDismissKeyword(text: string) {
  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|这个项目|项目/g, "")
    .replace(/取消提醒|取消待办|不需要提醒|无需提醒/g, "")
    .replace(/忽略|取消|不需要|无需|dismiss/gi, "")
    .replace(/提醒|待办/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : null;
}

function shouldGenerateStarterPlan(text: string) {
  if (/生成首月计划|创建首月计划|生成第一份素材包|创建第一份素材包/.test(text)) {
    return true;
  }

  return /生成素材包结构|创建素材包结构/.test(text) && !parseContentPackagePeriod(text);
}

function parseContentPackageOperation(text: string): ParsedAgentOperation | null {
  if (!/(新增|创建|生成|准备|安排).*(素材包|内容包)/.test(text)) {
    return null;
  }

  if (shouldGenerateStarterPlan(text)) {
    return null;
  }

  if (/(每周|每两周|双周|每月|每个月|月更|周更).*(生成|创建).*(一次|一份)?素材包/.test(text)) {
    return null;
  }

  const period = parseContentPackagePeriod(text);

  if (!period) {
    return null;
  }

  const channel = CHANNELS.find((channelName) =>
    text.toLowerCase().includes(channelName.toLowerCase()),
  );
  const frequency = parseFrequency(text) ?? ContentFrequency.WEEKLY;
  const name = `${period}${channel ? ` ${channel}` : ""} 素材包`;

  return {
    type: "create_content_package",
    value: {
      name,
      period,
      frequency,
      summary: "由 B 组 Agent 中文指令创建的素材包结构，待补充真实素材和审核。",
    },
    label: `创建素材包结构：${name}`,
  };
}

function parseSubmitContentPackageReviewOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(素材包|内容包)/.test(text) ||
    !/(提交审核|送审|发起审核|进入审核|提交.*审核|送去.*审核)/.test(text)
  ) {
    return null;
  }

  const keyword = extractPackageKeyword(text);

  return {
    type: "submit_content_package_review",
    value: {
      ...(keyword ? { keyword } : {}),
    },
    label: `提交素材包审核：${keyword ?? "最新素材包"}`,
  };
}

function parseContentPackageReadinessReminderOperation(
  text: string,
): ParsedAgentOperation | null {
  if (
    !/(素材包|内容包)/.test(text) ||
    !/(可交付|交付检查|交付性|缺口|阻塞|问题|风险)/.test(text) ||
    !/(生成|创建|加入|转成|变成).*(提醒|待办)/.test(text)
  ) {
    return null;
  }

  const keyword = extractPackageReadinessKeyword(text);

  return {
    type: "create_content_package_readiness_reminders",
    value: {
      ...(keyword ? { keyword } : {}),
      limit: 4,
    },
    label: `根据素材包可交付性缺口生成提醒：${keyword ?? "最新素材包"}`,
  };
}

function parseContentPackageFilesStatusOperation(text: string): ParsedAgentOperation | null {
  if (!/(素材包|内容包)/.test(text) || !/(全部文件|所有文件|文件项|交付文件)/.test(text)) {
    return null;
  }

  const status = parsePackageFileStatus(text);

  if (!status) {
    return null;
  }

  const keyword = extractPackageReadinessKeyword(text);
  const statusLabel =
    status === PackageFileStatus.APPROVED ? "全部文件审核通过" : "全部文件标记为已生成";

  return {
    type: "update_content_package_files_status",
    value: {
      ...(keyword ? { keyword } : {}),
      status,
    },
    label: `${statusLabel}：${keyword ?? "最新素材包"}`,
  };
}

function parseContentPackageStatusOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(素材包|内容包)/.test(text) ||
    /(审核任务|审核中心|待审核事项|待确认事项|复核事项)/.test(text)
  ) {
    return null;
  }

  const status = parseContentPackageStatus(text);

  if (!status) {
    return null;
  }

  const keyword = extractContentPackageStatusKeyword(text);
  const statusText = status === ContentPackageStatus.ARCHIVED ? "归档" : "恢复为草稿";

  return {
    type: "update_content_package_status",
    value: {
      status,
      ...(keyword ? { keyword } : {}),
    },
    label: `${statusText}素材包：${keyword ?? "最新素材包"}`,
  };
}

function parseContentPackageStatus(text: string) {
  if (/恢复为草稿|恢复草稿|改回草稿|重新打开|重新启用/.test(text)) {
    return ContentPackageStatus.DRAFT;
  }

  if (/归档|关闭素材包|关闭内容包|停用素材包|停用内容包|取消素材包|取消内容包/.test(text)) {
    return ContentPackageStatus.ARCHIVED;
  }

  return null;
}

function extractContentPackageStatusKeyword(text: string) {
  if (/(最新|最近|当前|这个|该).*(素材包|内容包)/.test(text)) {
    return undefined;
  }

  const keyword = extractPackageKeyword(text)
    ?.replace(/恢复为草稿|恢复草稿|改回草稿|重新打开|重新启用/g, "")
    .replace(/归档|关闭素材包|关闭内容包|停用素材包|停用内容包|取消素材包|取消内容包|取消/g, "")
    .trim();

  return keyword && keyword.length >= 2 ? keyword : undefined;
}

function parsePosterPackageAttachmentOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(素材包|内容包)/.test(text) ||
    !/(模板化海报|模板海报|海报图|海报图片|生成图)/.test(text) ||
    !/(关联|放进|加入|绑定|挂到|放到|插入)/.test(text)
  ) {
    return null;
  }

  const packageKeyword = extractPosterPackageKeyword(text);
  const assetKeyword = extractPosterAssetKeyword(text);

  return {
    type: "attach_latest_poster_to_content_package",
    value: {
      ...(packageKeyword ? { packageKeyword } : {}),
      ...(assetKeyword ? { assetKeyword } : {}),
    },
    label: `关联模板海报到素材包：${packageKeyword ?? "最新素材包"}`,
  };
}

function extractPosterPackageKeyword(text: string) {
  if (/(最新|最近|当前|这个|该).*(素材包|内容包)/.test(text)) {
    return undefined;
  }

  return extractPackageKeyword(text)
    ?.replace(/模板化海报|模板海报|海报图|海报图片|生成图|关联|放进|加入|绑定|挂到|放到|插入/g, "")
    .trim();
}

function extractPosterAssetKeyword(text: string) {
  if (/(最新|最近|当前|这个|该).*(模板化海报|模板海报|海报图|海报图片|生成图)/.test(text)) {
    return undefined;
  }

  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|这个项目|项目/g, "")
    .replace(/素材包|内容包|模板化海报|模板海报|海报图|海报图片|生成图/g, "")
    .replace(/关联|放进|加入|绑定|挂到|放到|插入|最新|最近|一张|一个/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : undefined;
}

function parsePackageFileStatus(text: string) {
  if (/审核通过|全部通过|文件通过|已通过/.test(text)) {
    return PackageFileStatus.APPROVED;
  }

  if (/已生成|生成完成|标记生成|标为已生成|设为已生成/.test(text)) {
    return PackageFileStatus.GENERATED;
  }

  return null;
}

function parseDecideContentPackageReviewOperation(text: string): ParsedAgentOperation | null {
  if (!/(素材包|内容包)/.test(text) || !/审核/.test(text)) {
    return null;
  }

  const decision = parseReviewDecision(text);

  if (!decision) {
    return null;
  }

  const keyword = extractPackageKeyword(text);
  const decisionText = decision === ReviewTaskStatus.APPROVED ? "审核通过" : "要求修改";

  return {
    type: "decide_content_package_review",
    value: {
      decision,
      ...(keyword ? { keyword } : {}),
      decisionNote: "由 B 组 Agent 中文指令处理。",
    },
    label: `${decisionText}：${keyword ?? "最新素材包"}`,
  };
}

function parseReviewTaskDecisionOperation(text: string): ParsedAgentOperation | null {
  if (/(素材包|内容包)/.test(text) || !/(审核|复核|审批)/.test(text)) {
    return null;
  }

  const decision = parseReviewDecision(text);

  if (!decision) {
    return null;
  }

  const subjectType = parseReviewSubjectType(text);
  const keyword = extractReviewTaskKeyword(text, subjectType);
  const decisionText = decision === ReviewTaskStatus.APPROVED ? "审核通过" : "要求修改";
  const subjectText = subjectType ? reviewSubjectTypeText(subjectType) : "最新审核任务";

  return {
    type: "decide_review_task",
    value: {
      ...(subjectType ? { subjectType } : {}),
      decision,
      ...(keyword ? { keyword } : {}),
      decisionNote: "由 B 组 Agent 中文指令处理。",
    },
    label: `${subjectText}${decisionText}${keyword ? `：${keyword}` : ""}`,
  };
}

function parseCancelReviewTaskOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(审核任务|审核中心|待审核事项|待确认事项|复核事项|审核|复核|审批)/.test(text) ||
    !/(取消|关闭|撤销|不需要审核|无需审核)/.test(text) ||
    parseReviewDecision(text)
  ) {
    return null;
  }

  const subjectType = parseReviewSubjectType(text);
  const keyword = extractReviewTaskKeyword(text, subjectType);
  const subjectText = subjectType ? reviewSubjectTypeText(subjectType) : "最新审核任务";

  return {
    type: "cancel_review_task",
    value: {
      ...(subjectType ? { subjectType } : {}),
      ...(keyword ? { keyword } : {}),
      decisionNote: "由 B 组 Agent 中文指令取消。",
    },
    label: `取消${subjectText}审核任务${keyword ? `：${keyword}` : ""}`,
  };
}

function parseReviewSubjectType(text: string) {
  if (/(素材包|内容包)/.test(text)) {
    return ReviewSubjectType.CONTENT_PACKAGE;
  }

  if (/(产品事实|事实复核|事实确认)/.test(text)) {
    return ReviewSubjectType.PRODUCT_FACT;
  }

  if (/(策略草案|项目策略|增长策略|内容策略|市场策略|策略确认|策略)/.test(text)) {
    return ReviewSubjectType.PROJECT_STRATEGY;
  }

  if (/(素材来源|产品图|商品图|官方\s*Logo|Logo|logo|素材审核|审核素材|资产)/.test(text)) {
    return ReviewSubjectType.ASSET;
  }

  return undefined;
}

function reviewSubjectTypeText(subjectType: ReviewSubjectType) {
  const labels: Record<ReviewSubjectType, string> = {
    ASSET: "素材",
    CONTENT_PACKAGE: "素材包",
    PRODUCT_FACT: "产品事实",
    PROJECT_STRATEGY: "策略草案",
  };

  return labels[subjectType];
}

function extractReviewTaskKeyword(text: string, subjectType?: ReviewSubjectType) {
  const subjectWords =
    subjectType === ReviewSubjectType.PRODUCT_FACT
      ? /产品事实|事实复核|事实确认|事实/g
      : subjectType === ReviewSubjectType.PROJECT_STRATEGY
        ? /策略草案|项目策略|增长策略|内容策略|市场策略|策略确认|策略/g
        : subjectType === ReviewSubjectType.ASSET
          ? /素材来源|素材审核|审核素材|素材|资产/g
          : subjectType === ReviewSubjectType.CONTENT_PACKAGE
            ? /素材包|内容包/g
            : /审核任务|审核中心|待审核事项|待确认事项|复核事项/g;
  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|这个项目|项目/g, "")
    .replace(subjectWords, "")
    .replace(/审核通过|通过审核|可以通过|批准|同意|要求修改|需要修改|退回修改|不通过|驳回|修改后再审/gi, "")
    .replace(/取消审核|取消任务|取消|关闭|撤销|不需要审核|无需审核/gi, "")
    .replace(/审核|复核|审批|任务|待处理|最新|最近|一条|一个/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : undefined;
}

function parseMissingReviewTasksOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(审核任务|审核中心|待审核事项|待确认事项|复核事项)/.test(text) ||
    !/(补齐|生成|创建|整理|加入)/.test(text)
  ) {
    return null;
  }

  return {
    type: "create_missing_review_tasks",
    value: {
      scope: "current_project",
    },
    label: "补齐当前项目审核任务",
  };
}

function extractPackageReadinessKeyword(text: string) {
  if (/(最新|最近|当前|这个|该)/.test(text)) {
    return null;
  }

  const keyword = extractPackageKeyword(text)
    ?.replace(/可交付性|可交付|交付检查|交付性|缺口|阻塞|问题|风险/g, "")
    .replace(/生成提醒|创建提醒|加入提醒|转成提醒|变成提醒|生成待办|创建待办|提醒|待办/g, "")
    .replace(/全部文件|所有文件|文件项|交付文件|已生成|生成完成|标记生成|标为已生成|设为已生成/g, "")
    .replace(/审核通过|全部通过|文件通过|已通过/g, "")
    .trim();

  return keyword && keyword.length >= 2 ? keyword : null;
}

function parseReviewDecision(text: string) {
  if (/要求修改|需要修改|退回修改|不通过|驳回|修改后再审|changes requested/i.test(text)) {
    return ReviewTaskStatus.CHANGES_REQUESTED;
  }

  if (/审核通过|通过审核|批准|同意|可以通过|approve|approved/i.test(text)) {
    return ReviewTaskStatus.APPROVED;
  }

  return null;
}

function parseContentPackagePeriod(text: string) {
  const explicitPeriod = text.match(/20\d{2}[-/.年]\d{1,2}(?:\s*(?:第\s*\d+\s*周|周|月))?/);

  if (explicitPeriod?.[0]) {
    return explicitPeriod[0].replace(/年/g, "-").replace(/月/g, "").replace(/\s+/g, " ").trim();
  }

  const relativePeriod = text.match(/(?:首月|本月|下个月|下月|本周|下周)(?:\s*第\s*\d+\s*周)?/);

  if (relativePeriod?.[0]) {
    return relativePeriod[0].replace(/\s+/g, " ").trim();
  }

  const week = parsePlanWeek(text);

  if (week) {
    return `第${week}周`;
  }

  return null;
}

function extractPackageKeyword(text: string) {
  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|项目/g, "")
    .replace(/提交审核|发起审核|进入审核|提交|送审|送去|审核/g, "")
    .replace(/审核通过|通过审核|通过|批准|同意|可以通过|要求修改|需要修改|退回修改|不通过|驳回|修改后再审|修改/g, "")
    .replace(/最新|最近|一份|一个|素材包|内容包/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : null;
}

function parseMetricsSnapshotOperation(text: string): ParsedAgentOperation | null {
  if (!/(记录|录入|导入|保存).*(曝光|点击|转化|花费|消耗)/.test(text)) {
    return null;
  }

  const channel = CHANNELS.find((channelName) => text.toLowerCase().includes(channelName.toLowerCase()));
  const period = parseMetricsPeriod(text);
  const impressions = extractMetricNumber(text, ["曝光", "展现", "impressions"]);
  const clicks = extractMetricNumber(text, ["点击", "clicks"]);
  const conversions = extractMetricNumber(text, ["转化", "成交", "询盘", "conversions"]);
  const spend = extractMetricNumber(text, ["花费", "消耗", "费用", "spend"]);

  if (
    !channel ||
    !period ||
    impressions === null ||
    clicks === null ||
    conversions === null ||
    spend === null
  ) {
    return null;
  }

  if (clicks > impressions || conversions > clicks) {
    return null;
  }

  const value = {
    period,
    channel,
    impressions: Math.round(impressions),
    clicks: Math.round(clicks),
    conversions: Math.round(conversions),
    spendCents: Math.round(spend * 100),
    notes: "由 B 组 Agent 中文指令录入。",
  };

  return {
    type: "create_metrics_snapshot",
    value,
    label: `录入指标：${period} · ${channel} · 曝光 ${value.impressions} / 点击 ${value.clicks} / 转化 ${value.conversions} / 花费 ¥${spend.toFixed(
      2,
    )}`,
  };
}

function parseMetricsBatchImportOperation(text: string): ParsedAgentOperation | null {
  const hasBatchIntent =
    /(批量|多行|表格|CSV|csv|粘贴|导入)/.test(text) &&
    /(指标|数据|表现|曝光|点击|转化|花费|消耗)/.test(text);
  const candidateLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:请|麻烦|帮我)?(?:批量)?(?:录入|导入|保存).{0,24}?[：:]\s*/, ""))
    .filter((line) => line.includes("\t") || line.includes(",") || line.includes("，"));

  if (candidateLines.length === 0 || (!hasBatchIntent && candidateLines.length < 2)) {
    return null;
  }

  try {
    const rows = parseMetricsImportRows(candidateLines.join("\n"));

    if (rows.length === 0 || (!hasBatchIntent && rows.length < 2)) {
      return null;
    }

    const channels = Array.from(new Set(rows.map((row) => row.channel))).slice(0, 4);

    return {
      type: "import_metrics_snapshots",
      value: {
        rows,
        source: "agent_paste",
      },
      label: `批量导入指标：${rows.length} 条，渠道 ${channels.join("、")}`,
    };
  } catch {
    return null;
  }
}

function parseMetricsRiskReminderOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(数据复盘|复盘风险|指标风险|渠道表现|表现数据|投放数据)/.test(text) ||
    !/(生成|创建|加入|转成|变成).*(提醒|待办)/.test(text)
  ) {
    return null;
  }

  return {
    type: "create_metrics_risk_reminders",
    value: {
      limit: 4,
    },
    label: "根据数据复盘风险生成提醒",
  };
}

function parseMetricsPeriod(text: string) {
  const periodPatterns = [
    /20\d{2}[-/.年]\d{1,2}(?:\s*(?:第\s*\d+\s*周|周|月))?/,
    /首月第\s*\d+\s*周/,
    /第\s*\d+\s*周/,
    /本周|上周|本月|上月|今天|昨天/,
  ];

  for (const pattern of periodPatterns) {
    const match = text.match(pattern);

    if (match?.[0]) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function extractMetricNumber(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)`, "i"));

    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      return Number.isFinite(value) && value >= 0 ? value : null;
    }
  }

  return null;
}

function parsePlanItemOperation(text: string): ParsedAgentOperation | null {
  if (!/(新增|创建|安排|加一条|加一个|做一条|做一个).*(计划|内容|视频|图文|脚本|海报|帖子|贴文)/.test(text)) {
    return null;
  }

  const channel = CHANNELS.find((channelName) =>
    text.toLowerCase().includes(channelName.toLowerCase()),
  );
  const week = parsePlanWeek(text);

  if (!channel || !week) {
    return null;
  }

  const theme = parsePlanTheme(text);
  const title = parsePlanTitle(text, channel);
  const deliverable = parsePlanDeliverable(text, title);
  const dueDate = parsePlanDueDate(text);
  const status = /可执行|ready|就绪|已准备/.test(text) ? PlanItemStatus.READY : PlanItemStatus.DRAFT;
  const value = {
    week,
    channel,
    theme,
    title,
    deliverable,
    ...(dueDate ? { dueDate } : {}),
    status,
  };

  return {
    type: "create_plan_item",
    value,
    label: `新增内容计划：第${week}周 · ${channel} · ${title}`,
  };
}

function parsePlanItemBatchImportOperation(text: string): ParsedAgentOperation | null {
  const hasBatchIntent =
    /(批量|多行|表格|CSV|csv|粘贴|导入)/.test(text) &&
    /(内容日历|内容计划|排期|计划|周次|交付物)/.test(text);
  const candidateLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:请|麻烦|帮我)?(?:批量)?(?:录入|导入|保存|新增).{0,24}?[：:]\s*/, ""))
    .filter((line) => line.includes("\t") || line.includes(",") || line.includes("，"));

  if (candidateLines.length === 0 || (!hasBatchIntent && candidateLines.length < 2)) {
    return null;
  }

  try {
    const rows = parseContentPlanImportRows(candidateLines.join("\n"));

    if (rows.length === 0 || (!hasBatchIntent && rows.length < 2)) {
      return null;
    }

    const channels = Array.from(new Set(rows.map((row) => row.channel))).slice(0, 4);

    return {
      type: "import_plan_items",
      value: {
        rows,
        source: "agent_paste",
      },
      label: `批量导入内容计划：${rows.length} 条，渠道 ${channels.join("、")}`,
    };
  } catch {
    return null;
  }
}

function parseCalendarGapReminderOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(内容日历|内容计划|排期|计划缺口|渠道缺口)/.test(text) ||
    !/(缺口|空缺|遗漏|没排|没有安排|未安排)/.test(text) ||
    !/(生成|创建|加入|转成|变成).*(提醒|待办)/.test(text)
  ) {
    return null;
  }

  return {
    type: "create_calendar_gap_reminders",
    value: {
      limit: 4,
    },
    label: "根据内容日历缺口生成提醒",
  };
}

function parseCompletePlanItemOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(计划|内容|视频|图文|脚本|海报|帖子|贴文)/.test(text) ||
    !hasCompletionIntent(text)
  ) {
    return null;
  }

  const channel = CHANNELS.find((channelName) =>
    text.toLowerCase().includes(channelName.toLowerCase()),
  );
  const week = parsePlanWeek(text) ?? undefined;
  const keyword = extractCompletionKeyword(text, [
    "计划",
    "内容计划",
    "内容",
    "视频",
    "短视频",
    "图文",
    "脚本",
    "海报",
    "帖子",
    "贴文",
    ...(channel ? [channel] : []),
  ]);
  const value = {
    ...(keyword ? { keyword } : {}),
    ...(week ? { week } : {}),
    ...(channel ? { channel } : {}),
  };

  if (!value.keyword && !value.week && !value.channel) {
    return null;
  }

  const scope = [
    value.week ? `第${value.week}周` : null,
    value.channel,
    value.keyword,
  ].filter(Boolean);

  return {
    type: "complete_plan_item",
    value,
    label: `完成内容计划：${scope.join(" · ")}`,
  };
}

function parsePlanItemStatusUpdateOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(计划|内容|视频|图文|脚本|海报|帖子|贴文)/.test(text) ||
    !/(标记|标为|设为|改为|改成|调整为|进入|退回|放回|暂缓|暂停)/.test(text)
  ) {
    return null;
  }

  const status = parsePlanItemStatus(text);

  if (!status) {
    return null;
  }

  const channel = CHANNELS.find((channelName) =>
    text.toLowerCase().includes(channelName.toLowerCase()),
  );
  const week = parsePlanWeek(text) ?? undefined;
  const keyword = extractPlanItemStatusKeyword(text, [
    "计划",
    "内容计划",
    "内容",
    "视频",
    "短视频",
    "图文",
    "脚本",
    "海报",
    "帖子",
    "贴文",
    ...(channel ? [channel] : []),
  ]);
  const value = {
    status,
    ...(keyword ? { keyword } : {}),
    ...(week ? { week } : {}),
    ...(channel ? { channel } : {}),
  };

  if (!value.keyword && !value.week && !value.channel) {
    return null;
  }

  const statusLabel: Record<PlanItemStatus, string> = {
    DRAFT: "草稿",
    READY: "可执行",
    REVIEW_NEEDED: "需审核",
    DONE: "已完成",
  };
  const scope = [
    value.week ? `第${value.week}周` : null,
    value.channel,
    value.keyword,
  ].filter(Boolean);

  return {
    type: "update_plan_item_status",
    value,
    label: `内容计划改为${statusLabel[status]}：${scope.join(" · ")}`,
  };
}

function parsePlanItemDueDateUpdateOperation(text: string): ParsedAgentOperation | null {
  if (
    !/(计划|内容|视频|图文|脚本|海报|帖子|贴文)/.test(text) ||
    !/(截止|交付时间|交付日期|排期日期|日期|due)/i.test(text) ||
    !/(改到|改为|改成|调整到|调整为|设为|定在|延后到|提前到|截止到|截止至)/.test(text)
  ) {
    return null;
  }

  const dueDate = parsePlanDueDate(text);

  if (!dueDate) {
    return null;
  }

  const channel = CHANNELS.find((channelName) =>
    text.toLowerCase().includes(channelName.toLowerCase()),
  );
  const week = parsePlanWeek(text) ?? undefined;
  const keyword = extractPlanItemDueDateKeyword(text, [
    "计划",
    "内容计划",
    "内容",
    "视频",
    "短视频",
    "图文",
    "脚本",
    "海报",
    "帖子",
    "贴文",
    ...(channel ? [channel] : []),
  ]);
  const value = {
    dueDate,
    ...(keyword ? { keyword } : {}),
    ...(week ? { week } : {}),
    ...(channel ? { channel } : {}),
  };

  if (!value.keyword && !value.week && !value.channel) {
    return null;
  }

  const scope = [
    value.week ? `第${value.week}周` : null,
    value.channel,
    value.keyword,
  ].filter(Boolean);

  return {
    type: "update_plan_item_due_date",
    value,
    label: `内容计划截止日期改为 ${dueDate}：${scope.join(" · ")}`,
  };
}

function parsePlanItemStatus(text: string): PlanItemStatus | null {
  if (/需审核|需要审核|待审核|进入审核|送审|待确认|复核/.test(text)) {
    return PlanItemStatus.REVIEW_NEEDED;
  }

  if (/可执行|ready|就绪|已准备|准备好|可以执行/.test(text)) {
    return PlanItemStatus.READY;
  }

  if (/草稿|待定|暂缓|暂停|退回|放回/.test(text)) {
    return PlanItemStatus.DRAFT;
  }

  return null;
}

function hasCompletionIntent(text: string) {
  return /已完成|完成了|完成|已处理|处理完|处理掉|关闭|解决|搞定|标记完成|标为完成|设为完成|done/i.test(
    text,
  );
}

function extractCompletionKeyword(text: string, removableTerms: string[]) {
  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|这个项目|项目/g, "")
    .replace(/标记为完成|标记完成|标为完成|设为完成/g, "")
    .replace(/已处理|处理完|处理掉|已完成|完成了|完成|关闭|解决|搞定|done/gi, "")
    .replace(new RegExp(removableTerms.map(escapeRegExp).join("|"), "gi"), "")
    .replace(/第\s*\d{1,2}\s*周/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : null;
}

function extractPlanItemStatusKeyword(text: string, removableTerms: string[]) {
  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|这个项目|项目/g, "")
    .replace(/标记为|标记|标为|设为|改为|改成|调整为|进入|退回|放回/g, "")
    .replace(/需审核|需要审核|待审核|审核|待确认|复核|送审/g, "")
    .replace(/可执行|ready|就绪|已准备|准备好|可以执行/gi, "")
    .replace(/草稿|待定|暂缓|暂停/g, "")
    .replace(new RegExp(removableTerms.map(escapeRegExp).join("|"), "gi"), "")
    .replace(/第\s*\d{1,2}\s*周/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : null;
}

function extractPlanItemDueDateKeyword(text: string, removableTerms: string[]) {
  const keyword = text
    .replace(/请|麻烦|帮我|把|将|当前|这个|这个项目|项目/g, "")
    .replace(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/g, "")
    .replace(/20\d{2}年\d{1,2}月\d{1,2}日?/g, "")
    .replace(/截止日期|交付时间|交付日期|排期日期|截止|日期|due/gi, "")
    .replace(/改到|改为|改成|调整到|调整为|设为|定在|延后到|提前到|截止到|截止至/g, "")
    .replace(new RegExp(removableTerms.map(escapeRegExp).join("|"), "gi"), "")
    .replace(/第\s*\d{1,2}\s*周/g, "")
    .replace(/，|。|！|!|：|:|；|;|、/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return keyword.length >= 2 ? keyword.slice(0, 80) : null;
}

function parsePlanWeek(text: string) {
  const weekMatch = text.match(/第\s*(\d{1,2})\s*周/);

  if (weekMatch?.[1]) {
    const week = Number.parseInt(weekMatch[1], 10);
    return week >= 1 && week <= 12 ? week : null;
  }

  if (/首周|第一周/.test(text)) {
    return 1;
  }

  if (/第二周/.test(text)) {
    return 2;
  }

  if (/第三周/.test(text)) {
    return 3;
  }

  if (/第四周/.test(text)) {
    return 4;
  }

  return null;
}

function parsePlanTheme(text: string) {
  const explicitTheme = extractTextAfterLabel(text, ["主题"]);

  if (explicitTheme) {
    return explicitTheme;
  }

  return DIRECTION_HINTS.find((direction) => text.includes(direction)) ?? "内容主题待确认";
}

function parsePlanTitle(text: string, channel: string) {
  const explicitTitle = extractTextAfterLabel(text, ["标题", "内容"]);

  if (explicitTitle) {
    return explicitTitle;
  }

  const actionMatch = text.match(/(?:做一条|做一个|安排一条|安排一个|新增一条|新增一个|创建一条|创建一个)\s*([^，。,；;]+)/);

  if (actionMatch?.[1]) {
    return actionMatch[1].replace(channel, "").trim().slice(0, 80) || `${channel} 内容计划`;
  }

  return `${channel} 内容计划`;
}

function parsePlanDeliverable(text: string, title: string) {
  const explicitDeliverable = extractTextAfterLabel(text, ["交付", "产出", "交付物"]);

  if (explicitDeliverable) {
    return explicitDeliverable;
  }

  if (/视频|短视频|脚本/.test(title)) {
    return "短视频脚本和发布配文";
  }

  if (/图文|轮播|帖子|贴文/.test(title)) {
    return "图文文案和配图";
  }

  if (/海报/.test(title)) {
    return "海报文案和模板图";
  }

  return "内容草案";
}

function parsePlanDueDate(text: string) {
  const isoDate = text.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/);

  if (isoDate?.[0]) {
    return normalizeDateText(isoDate[0]);
  }

  const zhDate = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日?/);

  if (zhDate?.[1] && zhDate[2] && zhDate[3]) {
    return `${zhDate[1]}-${zhDate[2].padStart(2, "0")}-${zhDate[3].padStart(2, "0")}`;
  }

  return undefined;
}

function normalizeDateText(value: string) {
  const [year, month, day] = value.replace(/\//g, "-").split("-");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTextAfterLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:：]?\\s*([^，。,；;]+)`));

    if (match?.[1]) {
      return match[1].trim().slice(0, 80);
    }
  }

  return null;
}

function operationKey(operation: ParsedAgentOperation) {
  return `${operation.type}:${
    typeof operation.value === "string" ? operation.value : JSON.stringify(operation.value)
  }`;
}

function summarizeOperations(operations: ParsedAgentOperation[]) {
  if (operations.length === 0) {
    return "我还没有识别到可安全执行的结构化操作，请补充市场、渠道、频率或内容方向。";
  }

  return operations.map((operation) => operation.label).join("；");
}

export function parseAgentCommand(rawText: string): ParsedAgentCommand {
  const text = rawText.trim();
  const operations: ParsedAgentOperation[] = [];
  const projectSwitchOperation = parseProjectSwitchOperation(text);

  if (projectSwitchOperation) {
    operations.push(projectSwitchOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  }

  const projectKickoffOperation = parseProjectKickoffOperation(text);

  if (projectKickoffOperation) {
    operations.push(projectKickoffOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  }

  const productCreationOperation = parseCreateProductOperation(text);

  if (productCreationOperation) {
    operations.push(productCreationOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  }

  const inferredProductFactsOperation = parseInferProductFactsFromTextOperation(text);

  if (inferredProductFactsOperation) {
    operations.push(inferredProductFactsOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  }

  const strategyRecommendationOperation = parseStrategyRecommendationOperation(text);

  if (strategyRecommendationOperation) {
    operations.push(strategyRecommendationOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  }

  const reminderOperation = parseReminderOperation(text);

  if (reminderOperation && hasLeadingReminderIntent(text)) {
    operations.push(reminderOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  }

  const dismissReminderOperation = parseDismissReminderOperation(text);

  if (dismissReminderOperation && hasLeadingDismissReminderIntent(text)) {
    operations.push(dismissReminderOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  }

  for (const [market, aliases] of MARKET_ALIASES) {
    if (includesAny(text, aliases)) {
      operations.push({
        type: "set_market",
        value: market,
        label: `目标市场设为：${market}`,
      });
      break;
    }
  }

  for (const channel of CHANNELS) {
    if (hasRemoveIntent(text, channel)) {
      operations.push({
        type: "remove_channel",
        value: channel,
        label: `删除渠道：${channel}`,
      });
    }

    if (hasAddIntent(text, channel)) {
      operations.push({
        type: "add_channel",
        value: channel,
        label: `新增渠道：${channel}`,
      });
    }
  }

  const projectStatus = parseProjectStatus(text);
  if (projectStatus) {
    const projectStatusLabel: Record<ProjectStatus, string> = {
      DRAFT: "草稿",
      ACTIVE: "进行中",
      PAUSED: "暂停",
      ARCHIVED: "已归档",
    };

    operations.push({
      type: "set_project_status",
      value: projectStatus,
      label: `项目状态改为：${projectStatusLabel[projectStatus]}`,
    });
  }

  if (reminderOperation) {
    operations.push(reminderOperation);
  }

  const projectHealthReminderOperation = parseProjectHealthReminderOperation(text);
  if (projectHealthReminderOperation) {
    operations.push(projectHealthReminderOperation);
  }

  const projectStrategyConfirmationOperation = parseProjectStrategyConfirmationOperation(text);
  if (projectStrategyConfirmationOperation) {
    operations.push(projectStrategyConfirmationOperation);
  }

  const productFactUpdateOperation = parseUpdateProductFactOperation(text);
  if (productFactUpdateOperation) {
    operations.push(productFactUpdateOperation);
  }

  const productFactOperation = parseProductFactOperation(text);
  if (productFactOperation) {
    operations.push(productFactOperation);
  }

  const confirmProductFactsOperation = parseConfirmProductFactsOperation(text);
  if (confirmProductFactsOperation) {
    operations.push(confirmProductFactsOperation);
  }

  const reminderCompletionOperation = parseCompleteReminderOperation(text);
  if (reminderCompletionOperation) {
    operations.push(reminderCompletionOperation);
  }

  const reminderDueDateOperation = parseReminderDueDateUpdateOperation(text);
  if (reminderDueDateOperation) {
    operations.push(reminderDueDateOperation);
  }

  if (dismissReminderOperation) {
    operations.push(dismissReminderOperation);
  }

  const frequency = parseFrequency(text);
  if (frequency) {
    const frequencyLabel: Record<ContentFrequency, string> = {
      WEEKLY: "每周一次",
      BIWEEKLY: "每两周一次",
      MONTHLY: "每月一次",
    };

    operations.push({
      type: "set_package_frequency",
      value: frequency,
      label: `素材包生成频率改为：${frequencyLabel[frequency]}`,
    });
  }

  if (shouldGenerateStarterPlan(text)) {
    operations.push({
      type: "generate_starter_plan",
      value: "first_month",
      label: "生成首月计划和第一份素材包结构",
    });
  }

  const contentPackageOperation = parseContentPackageOperation(text);
  if (contentPackageOperation) {
    operations.push(contentPackageOperation);
  }

  const contentPackageStatusOperation = parseContentPackageStatusOperation(text);
  if (contentPackageStatusOperation) {
    operations.push(contentPackageStatusOperation);
  }

  const contentPackageReadinessReminderOperation =
    parseContentPackageReadinessReminderOperation(text);
  if (contentPackageReadinessReminderOperation) {
    operations.push(contentPackageReadinessReminderOperation);
  }

  const contentPackageFilesStatusOperation = parseContentPackageFilesStatusOperation(text);
  if (contentPackageFilesStatusOperation) {
    operations.push(contentPackageFilesStatusOperation);
  }

  const posterPackageAttachmentOperation = parsePosterPackageAttachmentOperation(text);
  if (posterPackageAttachmentOperation) {
    operations.push(posterPackageAttachmentOperation);
  }

  const packageReviewOperation = parseSubmitContentPackageReviewOperation(text);
  if (packageReviewOperation) {
    operations.push(packageReviewOperation);
  }

  const packageReviewDecisionOperation = parseDecideContentPackageReviewOperation(text);
  if (packageReviewDecisionOperation) {
    operations.push(packageReviewDecisionOperation);
  }

  const reviewTaskDecisionOperation = parseReviewTaskDecisionOperation(text);
  if (reviewTaskDecisionOperation) {
    operations.push(reviewTaskDecisionOperation);
  }

  const cancelReviewTaskOperation = parseCancelReviewTaskOperation(text);
  if (cancelReviewTaskOperation) {
    operations.push(cancelReviewTaskOperation);
  }

  const missingReviewTasksOperation = parseMissingReviewTasksOperation(text);
  if (missingReviewTasksOperation) {
    operations.push(missingReviewTasksOperation);
  }

  const metricsBatchImportOperation = parseMetricsBatchImportOperation(text);
  if (metricsBatchImportOperation) {
    operations.push(metricsBatchImportOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  } else {
    const metricsOperation = parseMetricsSnapshotOperation(text);
    if (metricsOperation) {
      operations.push(metricsOperation);
    }
  }

  const metricsRiskReminderOperation = parseMetricsRiskReminderOperation(text);
  if (metricsRiskReminderOperation) {
    operations.push(metricsRiskReminderOperation);
  }

  const planItemBatchImportOperation = parsePlanItemBatchImportOperation(text);
  if (planItemBatchImportOperation) {
    operations.push(planItemBatchImportOperation);

    return {
      rawText: text,
      operations,
      summary: summarizeOperations(operations),
      confidence: "high",
    };
  } else {
    const planItemOperation = parsePlanItemOperation(text);
    if (planItemOperation) {
      operations.push(planItemOperation);
    }
  }

  const calendarGapReminderOperation = parseCalendarGapReminderOperation(text);
  if (calendarGapReminderOperation) {
    operations.push(calendarGapReminderOperation);
  }

  const planItemDueDateUpdateOperation = parsePlanItemDueDateUpdateOperation(text);
  if (planItemDueDateUpdateOperation) {
    operations.push(planItemDueDateUpdateOperation);
  }

  const planItemStatusUpdateOperation = parsePlanItemStatusUpdateOperation(text);
  if (planItemStatusUpdateOperation) {
    operations.push(planItemStatusUpdateOperation);
  }

  const planItemCompletionOperation = parseCompletePlanItemOperation(text);
  if (planItemCompletionOperation) {
    operations.push(planItemCompletionOperation);
  }

  for (const audience of AUDIENCE_HINTS) {
    if (hasRemoveIntent(text, audience)) {
      operations.push({
        type: "remove_audience",
        value: audience,
        label: `删除客群：${audience}`,
      });
      continue;
    }

    if (hasAddIntent(text, audience) || text.includes(`面向${audience}`)) {
      operations.push({
        type: "add_audience",
        value: audience,
        label: `新增客群：${audience}`,
      });
    }
  }

  for (const direction of DIRECTION_HINTS) {
    if (hasRemoveIntent(text, direction)) {
      operations.push({
        type: "remove_content_direction",
        value: direction,
        label: `删除内容方向：${direction}`,
      });
      continue;
    }

    if (text.includes(direction)) {
      operations.push({
        type: "add_content_direction",
        value: direction,
        label: `新增内容方向：${direction}`,
      });
    }
  }

  if (operations.length === 0) {
    const projectSummaryOperation = parseProjectSummaryOperation(text);

    if (projectSummaryOperation) {
      operations.push(projectSummaryOperation);
    }
  }

  const dedupedOperations = Array.from(
    new Map(operations.map((operation) => [operationKey(operation), operation])).values(),
  );
  const hasCompleteMetricsOperation = dedupedOperations.some(
    (operation) =>
      operation.type === "create_metrics_snapshot" ||
      operation.type === "import_metrics_snapshots",
  );
  const hasCompletePlanItemOperation = dedupedOperations.some(
    (operation) =>
      operation.type === "create_plan_item" ||
      operation.type === "import_plan_items" ||
      operation.type === "update_plan_item_status" ||
      operation.type === "update_plan_item_due_date" ||
      operation.type === "complete_plan_item",
  );
  const hasCompleteWorkflowOperation = dedupedOperations.some(
    (operation) =>
      operation.type === "complete_reminder" ||
      operation.type === "dismiss_reminder" ||
      operation.type === "update_reminder_due_date" ||
      operation.type === "create_project_health_reminders" ||
      operation.type === "create_product_fact" ||
      operation.type === "create_product" ||
      operation.type === "update_product_fact" ||
      operation.type === "infer_product_facts_from_text" ||
      operation.type === "confirm_product_facts" ||
      operation.type === "kickoff_project" ||
      operation.type === "switch_project" ||
      operation.type === "summarize_project" ||
      operation.type === "recommend_strategy" ||
      operation.type === "confirm_project_strategy" ||
      operation.type === "create_content_package" ||
      operation.type === "update_content_package_status" ||
      operation.type === "create_content_package_readiness_reminders" ||
      operation.type === "update_content_package_files_status" ||
      operation.type === "attach_latest_poster_to_content_package" ||
      operation.type === "submit_content_package_review" ||
      operation.type === "decide_content_package_review" ||
      operation.type === "decide_review_task" ||
      operation.type === "cancel_review_task" ||
      operation.type === "create_metrics_risk_reminders" ||
      operation.type === "create_calendar_gap_reminders" ||
      operation.type === "import_plan_items" ||
      operation.type === "create_missing_review_tasks",
  );

  return {
    rawText: text,
    operations: dedupedOperations,
    summary: summarizeOperations(dedupedOperations),
    confidence:
      dedupedOperations.length >= 2 ||
      hasCompleteMetricsOperation ||
      hasCompletePlanItemOperation ||
      hasCompleteWorkflowOperation
        ? "high"
        : dedupedOperations.length === 1
          ? "medium"
          : "low",
  };
}
