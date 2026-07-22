import { ContentFrequency, type ProductFactStatus } from "@prisma/client";

export type StrategyRecommendationProduct = {
  name: string;
  description?: string | null;
  facts: Array<{
    label: string;
    value: string;
    status?: ProductFactStatus;
  }>;
};

export type StrategyRecommendationInput = {
  projectName: string;
  products: StrategyRecommendationProduct[];
  contextText?: string;
};

export type StrategyRecommendation = {
  targetMarkets: string[];
  audiences: string[];
  channels: string[];
  contentDirections: string[];
  packageFrequency: ContentFrequency;
  positioning: string;
  rationale: string;
};

export function buildStrategyRecommendation(
  input: StrategyRecommendationInput,
): StrategyRecommendation {
  const productNames = input.products.map((product) => product.name).filter(Boolean);
  const basisText = input.products
    .flatMap((product) => [
      product.name,
      product.description ?? "",
      ...product.facts.map((fact) => `${fact.label}：${fact.value}`),
      input.contextText ?? "",
    ])
    .join(" ");
  const targetMarkets = inferTargetMarkets(basisText);
  const audiences = inferAudiences(basisText);
  const channels = inferChannels(targetMarkets, basisText);
  const contentDirections = inferContentDirections(basisText);
  const packageFrequency = inferPackageFrequency(basisText, channels);
  const marketText = targetMarkets.join("、");
  const audienceText = audiences.slice(0, 2).join("、");
  const directionText = contentDirections.slice(0, 2).join("、");
  const productText = productNames.length > 0 ? productNames.join("、") : input.projectName;
  const usableFactCount = input.products.reduce(
    (total, product) => total + product.facts.length,
    0,
  );

  return {
    targetMarkets,
    audiences,
    channels,
    contentDirections,
    packageFrequency,
    positioning: `${productText} 面向 ${audienceText}，以 ${directionText} 切入 ${marketText}。`,
    rationale: [
      `基于 ${input.products.length} 个关联产品和 ${usableFactCount} 条产品事实生成本地规则型策略草案。`,
      "正式投放前需要人工确认市场优先级、产品参数、平台限制和合规表达。",
    ].join(" "),
  };
}

function inferTargetMarkets(text: string) {
  const markets: string[] = [];

  if (/巴西|Brazil/i.test(text)) {
    markets.push("巴西");
  }

  if (/蒙古|Mongolia/i.test(text)) {
    markets.push("蒙古");
  }

  if (/美国|USA|United States|America/i.test(text)) {
    markets.push("美国");
  }

  if (/日本|Japan/i.test(text)) {
    markets.push("日本");
  }

  if (/韩国|Korea/i.test(text)) {
    markets.push("韩国");
  }

  if (/东南亚|Southeast Asia|泰国|越南|印尼|马来西亚/i.test(text)) {
    markets.push("东南亚");
  }

  return unique(markets.length > 0 ? markets : ["待确认市场"]);
}

function inferChannels(markets: string[], text: string) {
  const channels = new Set<string>();

  for (const market of markets) {
    for (const channel of marketChannelMap[market] ?? ["TikTok", "Instagram"]) {
      channels.add(channel);
    }
  }

  if (/视频|短视频|开箱|TikTok|抖音/i.test(text)) {
    channels.add("TikTok");
  }

  if (/图文|生活方式|视觉|海报|Instagram/i.test(text)) {
    channels.add("Instagram");
  }

  if (/Facebook|社群|抽奖|活动/i.test(text)) {
    channels.add("Facebook");
  }

  if (/B2B|经销商|代理商|LinkedIn/i.test(text)) {
    channels.add("LinkedIn");
  }

  return Array.from(channels);
}

function inferAudiences(text: string) {
  const audiences: string[] = [];

  if (/通勤|上班|便携|随身|办公室|白领/.test(text)) {
    audiences.push("年轻通勤人群");
  }

  if (/健身|运动|户外/.test(text)) {
    audiences.push("健身和户外用户");
  }

  if (/礼品|礼赠|送礼|节日/.test(text)) {
    audiences.push("礼品购买者");
  }

  if (/学生|校园|课堂|学习/.test(text)) {
    audiences.push("学生用户");
  }

  if (/B2B|经销商|代理商|采购/.test(text)) {
    audiences.push("渠道采购和经销商");
  }

  return unique(audiences.length > 0 ? audiences : ["核心用户待确认"]);
}

function inferContentDirections(text: string) {
  const directions: string[] = ["新品认知"];

  if (/保温|保冷|24\s?小时|长效/.test(text)) {
    directions.push("长效保温场景");
  }

  if (/通勤|便携|随身/.test(text)) {
    directions.push("通勤随身");
  }

  if (/健身|运动|户外/.test(text)) {
    directions.push("运动户外");
  }

  if (/礼品|礼赠|送礼|节日|圣诞|黑五/.test(text)) {
    directions.push("节日礼赠");
  }

  if (/高颜值|设计感|配色|质感|Logo|海报|视觉/.test(text)) {
    directions.push("高颜值开箱");
  }

  if (/BPA|食品级|不锈钢|认证|安全材质/.test(text)) {
    directions.push("安全材质科普");
  }

  return unique(directions.length > 1 ? directions : ["新品认知", "场景种草", "转化促销"]);
}

function inferPackageFrequency(text: string, channels: string[]) {
  if (/每两周|双周|biweekly/i.test(text)) {
    return ContentFrequency.BIWEEKLY;
  }

  if (/每月|月更|monthly/i.test(text)) {
    return ContentFrequency.MONTHLY;
  }

  if (/每周|周更|weekly|首月|新品|发布|上市/i.test(text) || channels.length >= 2) {
    return ContentFrequency.WEEKLY;
  }

  return ContentFrequency.MONTHLY;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

const marketChannelMap: Record<string, string[]> = {
  巴西: ["TikTok", "Instagram", "Facebook"],
  蒙古: ["Facebook", "Instagram"],
  美国: ["TikTok", "Instagram", "YouTube"],
  日本: ["Instagram", "TikTok", "X"],
  韩国: ["Instagram", "TikTok"],
  东南亚: ["TikTok", "Instagram", "Facebook"],
  待确认市场: ["TikTok", "Instagram"],
};
