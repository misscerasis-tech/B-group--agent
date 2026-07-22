export type MetricsImportRow = {
  period: string;
  channel: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  notes?: string;
};

export function parseMetricsImportRows(rawText: string): MetricsImportRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("请粘贴至少一行指标数据。");
  }

  const dataLines = isHeaderLine(lines[0]) ? lines.slice(1) : lines;
  const rows = dataLines.map((line, index) => parseMetricsLine(line, index + 1));

  if (rows.length === 0) {
    throw new Error("没有识别到可导入的指标数据。");
  }

  return rows;
}

function parseMetricsLine(line: string, rowNumber: number): MetricsImportRow {
  const cells = splitDelimitedLine(line);

  if (cells.length < 6) {
    throw new Error(`第 ${rowNumber} 行至少需要：周期、渠道、曝光、点击、转化、花费。`);
  }

  const [period, channel, impressions, clicks, conversions, spend, notes] = cells;
  const parsed = {
    period: requireText(period, rowNumber, "周期"),
    channel: requireText(channel, rowNumber, "渠道"),
    impressions: parseNonNegativeInteger(impressions, rowNumber, "曝光"),
    clicks: parseNonNegativeInteger(clicks, rowNumber, "点击"),
    conversions: parseNonNegativeInteger(conversions, rowNumber, "转化"),
    spendCents: parseSpendCents(spend, rowNumber),
    notes: notes?.trim() || undefined,
  };

  if (parsed.clicks > parsed.impressions) {
    throw new Error(`第 ${rowNumber} 行点击不能大于曝光。`);
  }

  if (parsed.conversions > parsed.clicks) {
    throw new Error(`第 ${rowNumber} 行转化不能大于点击。`);
  }

  return parsed;
}

function isHeaderLine(line: string) {
  const compact = line.replace(/\s+/g, "");
  return compact.includes("周期") && compact.includes("渠道") && compact.includes("曝光");
}

function splitDelimitedLine(line: string) {
  if (line.includes("\t")) {
    return line.split("\t").map((cell) => cell.trim());
  }

  return splitCsvLine(line.replace(/，/g, ","));
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function requireText(value: string | undefined, rowNumber: number, label: string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`第 ${rowNumber} 行${label}不能为空。`);
  }

  return normalizedValue;
}

function parseNonNegativeInteger(value: string | undefined, rowNumber: number, label: string) {
  const parsed = Number.parseInt(requireText(value, rowNumber, label), 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`第 ${rowNumber} 行${label}必须是大于或等于 0 的整数。`);
  }

  return parsed;
}

function parseSpendCents(value: string | undefined, rowNumber: number) {
  const parsed = Number.parseFloat(requireText(value, rowNumber, "花费"));

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`第 ${rowNumber} 行花费必须是大于或等于 0 的数字。`);
  }

  return Math.round(parsed * 100);
}
