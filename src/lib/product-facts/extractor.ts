export type InferredProductFact = {
  label: string;
  value: string;
  confidence: number;
};

export function inferProductFactsFromText(input: {
  productName: string;
  description?: string | null;
  sourceText?: string;
}) {
  const description = input.description?.trim() || "暂无产品说明";
  const sourceText = input.sourceText?.trim();
  const text = [input.productName, description, sourceText].filter(Boolean).join("。");
  const sellingPoints = inferSellingPoints(text);
  const specs = inferSpecs(text);
  const scenes = inferScenes(text);
  const audiences = inferAudiences(text);

  return [
    {
      label: "产品名称",
      value: input.productName,
      confidence: 95,
    },
    {
      label: "产品说明",
      value: sourceText || description,
      confidence: sourceText || input.description ? 78 : 40,
    },
    {
      label: "核心卖点",
      value: sellingPoints.length > 0 ? sellingPoints.join("、") : "待人工补充核心卖点",
      confidence: sellingPoints.length > 0 ? 76 : 42,
    },
    {
      label: "规格参数",
      value: specs.length > 0 ? specs.join("、") : "待人工补充容量、材质、尺寸或续航等参数",
      confidence: specs.length > 0 ? 74 : 38,
    },
    {
      label: "目标场景",
      value: scenes.length > 0 ? scenes.join("、") : "待人工补充使用场景",
      confidence: scenes.length > 0 ? 68 : 42,
    },
    {
      label: "目标人群",
      value: audiences.length > 0 ? audiences.join("、") : "待人工补充目标人群",
      confidence: audiences.length > 0 ? 66 : 40,
    },
    {
      label: "视觉限制",
      value: "正式素材必须使用已审核真实产品图和官方 Logo，禁止 AI 重绘产品结构。",
      confidence: 100,
    },
    {
      label: "合规注意",
      value: inferComplianceNotes(text),
      confidence: 72,
    },
  ] satisfies InferredProductFact[];
}

function inferSellingPoints(text: string) {
  const rules: Array<[string, string[]]> = [
    ["温度显示", ["温显", "温度显示", "智能温控"]],
    ["长效保温", ["保温", "保冷", "24 小时", "24小时", "长效"]],
    ["防漏便携", ["防漏", "便携", "轻量", "随身"]],
    ["礼品属性", ["礼品", "礼赠", "送礼", "节日"]],
    ["高颜值设计", ["高颜值", "设计感", "配色", "质感"]],
    ["安全材质", ["BPA", "食品级", "不锈钢", "安全材质"]],
  ];

  return inferByRules(text, rules);
}

function inferSpecs(text: string) {
  const specs = new Set<string>();
  const capacityMatches = text.match(/\d+(?:\.\d+)?\s?(?:ml|mL|ML|L|升|毫升|oz)/g) ?? [];
  const durationMatches = text.match(/\d+\s?(?:小时|h|H)/g) ?? [];

  for (const value of capacityMatches) {
    specs.add(`容量 ${value.replace(/\s+/g, "")}`);
  }

  for (const value of durationMatches) {
    specs.add(`时长 ${value.replace(/\s+/g, "")}`);
  }

  if (text.includes("不锈钢")) {
    specs.add("不锈钢材质");
  }

  if (text.includes("BPA")) {
    specs.add("BPA 相关安全声明需核实");
  }

  return Array.from(specs);
}

function inferScenes(text: string) {
  const sceneRules: Array<[string, string[]]> = [
    ["通勤", ["通勤", "便携", "上班", "办公室"]],
    ["健身", ["健身", "运动", "户外"]],
    ["礼赠", ["礼品", "礼赠", "送礼", "节日"]],
    ["家庭", ["家庭", "亲子", "厨房"]],
    ["校园", ["学生", "校园", "课堂"]],
  ];

  return inferByRules(text, sceneRules);
}

function inferAudiences(text: string) {
  const audienceRules: Array<[string, string[]]> = [
    ["年轻通勤人群", ["年轻", "通勤", "上班"]],
    ["健身和户外用户", ["健身", "运动", "户外"]],
    ["礼品购买者", ["礼品", "礼赠", "送礼"]],
    ["办公人群", ["办公室", "办公桌", "白领"]],
    ["学生用户", ["学生", "校园"]],
  ];

  return inferByRules(text, audienceRules);
}

function inferComplianceNotes(text: string) {
  const notes = ["所有卖点、参数和材质声明必须与官方资料一致。"];

  if (text.includes("BPA") || text.includes("食品级")) {
    notes.push("食品接触、BPA 或安全材质声明发布前需要确认检测或认证依据。");
  }

  if (text.includes("抽奖") || text.includes("促销") || text.includes("活动")) {
    notes.push("抽奖或促销活动需要确认规则、奖品、地域限制和免责声明。");
  }

  return notes.join(" ");
}

function inferByRules(text: string, rules: Array<[string, string[]]>) {
  return rules
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([value]) => value);
}
