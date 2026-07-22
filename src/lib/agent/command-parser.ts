import { ContentFrequency, PlanItemStatus, ProjectStatus, ReminderSeverity } from "@prisma/client";

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
      type: "create_reminder";
      value: string;
      label: string;
      severity: ReminderSeverity;
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

function shouldGenerateStarterPlan(text: string) {
  return /生成首月计划|创建首月计划|生成第一份素材包|创建第一份素材包|生成素材包结构|创建素材包结构/.test(text);
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

  const reminderTitle = parseReminderTitle(text);
  if (reminderTitle) {
    const severity = parseReminderSeverity(text);
    const severityLabel: Record<ReminderSeverity, string> = {
      INFO: "提示",
      WARNING: "风险",
      CRITICAL: "紧急",
    };

    operations.push({
      type: "create_reminder",
      value: reminderTitle,
      severity,
      label: `创建${severityLabel[severity]}提醒：${reminderTitle}`,
    });
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

  const metricsOperation = parseMetricsSnapshotOperation(text);
  if (metricsOperation) {
    operations.push(metricsOperation);
  }

  const planItemOperation = parsePlanItemOperation(text);
  if (planItemOperation) {
    operations.push(planItemOperation);
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

  const dedupedOperations = Array.from(
    new Map(operations.map((operation) => [operationKey(operation), operation])).values(),
  );
  const hasCompleteMetricsOperation = dedupedOperations.some(
    (operation) => operation.type === "create_metrics_snapshot",
  );
  const hasCompletePlanItemOperation = dedupedOperations.some(
    (operation) => operation.type === "create_plan_item",
  );

  return {
    rawText: text,
    operations: dedupedOperations,
    summary: summarizeOperations(dedupedOperations),
    confidence:
      dedupedOperations.length >= 2 || hasCompleteMetricsOperation || hasCompletePlanItemOperation
        ? "high"
        : dedupedOperations.length === 1
          ? "medium"
          : "low",
  };
}
