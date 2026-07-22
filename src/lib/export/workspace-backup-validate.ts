import { WORKSPACE_BACKUP_SCHEMA_VERSION } from "@/lib/export/workspace-backup";

const SENSITIVE_KEY_PATTERN = /(secret|token|password|api_?key|credential|tenant_?key)/i;
const STRUCTURED_ARRAY_KEYS = [
  "members",
  "projects",
  "products",
  "projectStrategies",
  "contentPlanItems",
  "contentPackages",
  "reviewTasks",
  "reminders",
  "metricsSnapshots",
  "conversations",
  "agentOperations",
  "changeLogs",
  "assets",
  "imageProviderConfigs",
  "imageGenerationJobs",
  "integrationConnections",
  "integrationMigrationRecords",
] as const;

const COUNT_KEYS = [
  "projects",
  "products",
  "assets",
  "contentPackages",
  "reminders",
  "metricsSnapshots",
  "changeLogs",
] as const;

export type WorkspaceBackupValidationResult = {
  ok: boolean;
  schemaVersion?: string;
  workspaceId?: string;
  issues: string[];
  warnings: string[];
  counts: Record<string, number>;
};

export function validateWorkspaceBackupEnvelope(value: unknown): WorkspaceBackupValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: ["备份文件不是 JSON 对象。"],
      warnings,
      counts,
    };
  }

  const schemaVersion = typeof value.schemaVersion === "string" ? value.schemaVersion : undefined;

  if (schemaVersion !== WORKSPACE_BACKUP_SCHEMA_VERSION) {
    issues.push(
      `schemaVersion 不匹配：期望 ${WORKSPACE_BACKUP_SCHEMA_VERSION}，实际 ${schemaVersion ?? "缺失"}。`,
    );
  }

  const data = isRecord(value.data) ? value.data : null;

  if (!data) {
    issues.push("备份缺少 data 对象。");
  }

  const workspace = data && isRecord(data.workspace) ? data.workspace : null;
  const workspaceId = typeof workspace?.id === "string" ? workspace.id : undefined;

  if (!workspaceId) {
    issues.push("备份缺少 data.workspace.id。");
  }

  for (const key of STRUCTURED_ARRAY_KEYS) {
    const records = data?.[key];

    if (!Array.isArray(records)) {
      issues.push(`data.${key} 必须是数组。`);
      continue;
    }

    counts[key] = records.length;
    checkWorkspaceScope(records, key, workspaceId, issues);
  }

  const exportedCounts = isRecord(value.counts) ? value.counts : null;

  if (!exportedCounts) {
    warnings.push("备份缺少 counts 对象，无法核对摘要计数。");
  } else {
    for (const key of COUNT_KEYS) {
      const expected = counts[key];
      const actual = exportedCounts[key];

      if (typeof expected === "number" && actual !== expected) {
        issues.push(`counts.${key}=${String(actual)} 与 data.${key}.length=${expected} 不一致。`);
      }
    }
  }

  const safety = isRecord(value.safety) ? value.safety : null;

  if (!safety) {
    warnings.push("备份缺少 safety 对象，建议重新导出。");
  } else {
    if (safety.includesSecrets !== false) {
      issues.push("safety.includesSecrets 必须为 false。");
    }

    if (safety.includesUploadedFileBytes !== false) {
      warnings.push("safety.includesUploadedFileBytes 不是 false，请确认备份没有包含上传文件二进制。");
    }
  }

  findSensitiveLeaks(value, "$", issues);

  return {
    ok: issues.length === 0,
    schemaVersion,
    workspaceId,
    issues,
    warnings,
    counts,
  };
}

function checkWorkspaceScope(
  records: unknown[],
  key: string,
  workspaceId: string | undefined,
  issues: string[],
) {
  if (!workspaceId) {
    return;
  }

  for (const [index, record] of records.entries()) {
    if (!isRecord(record) || !("workspaceId" in record)) {
      continue;
    }

    if (record.workspaceId !== workspaceId) {
      issues.push(`data.${key}[${index}].workspaceId 不属于当前 Workspace。`);
    }
  }
}

function findSensitiveLeaks(value: unknown, path: string, issues: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveLeaks(item, `${path}[${index}]`, issues));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (
      SENSITIVE_KEY_PATTERN.test(key) &&
      child != null &&
      child !== false &&
      child !== "[REDACTED]"
    ) {
      issues.push(`${childPath} 疑似敏感字段未脱敏。`);
    }

    findSensitiveLeaks(child, childPath, issues);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
