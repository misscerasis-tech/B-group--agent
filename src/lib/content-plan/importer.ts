import { PlanItemStatus } from "@prisma/client";

export type ContentPlanImportRow = {
  week: number;
  channel: string;
  theme: string;
  title: string;
  deliverable: string;
  dueDate?: string;
  status: PlanItemStatus;
};

export function parseContentPlanImportRows(rawText: string): ContentPlanImportRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("请粘贴至少一行内容计划。");
  }

  const dataLines = isHeaderLine(lines[0]) ? lines.slice(1) : lines;
  const rows = dataLines.map((line, index) => parseContentPlanLine(line, index + 1));

  if (rows.length === 0) {
    throw new Error("没有识别到可导入的内容计划。");
  }

  return rows;
}

function parseContentPlanLine(line: string, rowNumber: number): ContentPlanImportRow {
  const cells = splitDelimitedLine(line);

  if (cells.length < 5) {
    throw new Error(`第 ${rowNumber} 行至少需要：周次、渠道、主题、标题、交付物。`);
  }

  const [week, channel, theme, title, deliverable, dueDate, status] = cells;

  return {
    week: parseWeek(week, rowNumber),
    channel: requireText(channel, rowNumber, "渠道"),
    theme: requireText(theme, rowNumber, "主题"),
    title: requireText(title, rowNumber, "标题"),
    deliverable: requireText(deliverable, rowNumber, "交付物"),
    ...(dueDate?.trim() ? { dueDate: parseDate(dueDate, rowNumber) } : {}),
    status: parseStatus(status),
  };
}

function isHeaderLine(line: string) {
  const compact = line.replace(/\s+/g, "");
  return compact.includes("周次") && compact.includes("渠道") && compact.includes("标题");
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

function parseWeek(value: string | undefined, rowNumber: number) {
  const normalizedValue = requireText(value, rowNumber, "周次").replace(/\s+/g, "");
  const matchedWeek = normalizedValue.match(/^(?:第)?(\d{1,2})(?:周)?$/);
  const week = matchedWeek?.[1] ? Number.parseInt(matchedWeek[1], 10) : Number.NaN;

  if (!Number.isInteger(week) || week < 1 || week > 12) {
    throw new Error(`第 ${rowNumber} 行周次必须是 1 到 12 之间的整数。`);
  }

  return week;
}

function parseDate(value: string, rowNumber: number) {
  const normalizedValue = value
    .trim()
    .replace(/[./]/g, "-")
    .replace(/年|月/g, "-")
    .replace(/日/g, "");
  const matchedDate = normalizedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!matchedDate) {
    throw new Error(`第 ${rowNumber} 行截止日期必须是 YYYY-MM-DD 格式。`);
  }

  const [, year, month, day] = matchedDate;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseStatus(value: string | undefined) {
  const normalizedValue = value?.trim().toUpperCase();

  if (!normalizedValue || normalizedValue === "可执行" || normalizedValue === "READY") {
    return PlanItemStatus.READY;
  }

  if (normalizedValue === "草稿" || normalizedValue === "DRAFT") {
    return PlanItemStatus.DRAFT;
  }

  if (
    normalizedValue === "需审核" ||
    normalizedValue === "待审核" ||
    normalizedValue === "REVIEW_NEEDED"
  ) {
    return PlanItemStatus.REVIEW_NEEDED;
  }

  if (normalizedValue === "已完成" || normalizedValue === "完成" || normalizedValue === "DONE") {
    return PlanItemStatus.DONE;
  }

  return PlanItemStatus.READY;
}
