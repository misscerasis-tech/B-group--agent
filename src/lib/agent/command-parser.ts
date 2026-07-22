import { ContentFrequency } from "@prisma/client";

export type ParsedAgentOperation =
  | {
      type: "add_channel" | "remove_channel" | "set_market" | "add_content_direction";
      value: string;
      label: string;
    }
  | {
      type: "set_package_frequency";
      value: ContentFrequency;
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

const DIRECTION_HINTS = ["世界杯", "那达慕", "圣诞", "黑五", "返校季", "通勤", "健身", "礼赠"];

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

  for (const direction of DIRECTION_HINTS) {
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
