import { ContentFrequency, ProjectStatus } from "@prisma/client";

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

function operationKey(operation: ParsedAgentOperation) {
  return `${operation.type}:${operation.value}`;
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

  return {
    rawText: text,
    operations: dedupedOperations,
    summary: summarizeOperations(dedupedOperations),
    confidence:
      dedupedOperations.length >= 2 ? "high" : dedupedOperations.length === 1 ? "medium" : "low",
  };
}
