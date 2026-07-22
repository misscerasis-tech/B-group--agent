import type {
  AgentOperationStatus,
  ContentFrequency,
  ContentPackageStatus,
  PackageFileStatus,
  PlanItemStatus,
  ProductFactStatus,
  ProductStatus,
  ProjectStatus,
  ReminderSeverity,
  ReminderStatus,
  StrategyStatus,
  WorkspaceRole,
} from "@prisma/client";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  PAUSED: "暂停",
  ARCHIVED: "已归档",
};

export const productStatusLabels: Record<ProductStatus, string> = {
  DRAFT: "草稿",
  ACTIVE: "启用",
  ARCHIVED: "已归档",
};

export const workspaceRoleLabels: Record<WorkspaceRole, string> = {
  OWNER: "所有者",
  ADMIN: "管理员",
  MEMBER: "成员",
  VIEWER: "访客",
};

export const productFactStatusLabels: Record<ProductFactStatus, string> = {
  DRAFT: "待确认",
  CONFIRMED: "已确认",
  NEEDS_REVIEW: "需复核",
};

export const strategyStatusLabels: Record<StrategyStatus, string> = {
  DRAFT: "策略草案",
  CONFIRMED: "正式策略",
  ARCHIVED: "已归档",
};

export const contentFrequencyLabels: Record<ContentFrequency, string> = {
  WEEKLY: "每周一次",
  BIWEEKLY: "每两周一次",
  MONTHLY: "每月一次",
};

export const planItemStatusLabels: Record<PlanItemStatus, string> = {
  DRAFT: "草稿",
  READY: "可执行",
  REVIEW_NEEDED: "需审核",
  DONE: "已完成",
};

export const contentPackageStatusLabels: Record<ContentPackageStatus, string> = {
  DRAFT: "草稿",
  GENERATED: "已生成",
  REVIEW_NEEDED: "需审核",
  APPROVED: "已通过",
  ARCHIVED: "已归档",
};

export const packageFileStatusLabels: Record<PackageFileStatus, string> = {
  PLANNED: "待生成",
  GENERATED: "已生成",
  APPROVED: "已通过",
};

export const reminderSeverityLabels: Record<ReminderSeverity, string> = {
  INFO: "提示",
  WARNING: "风险",
  CRITICAL: "紧急",
};

export const reminderStatusLabels: Record<ReminderStatus, string> = {
  OPEN: "待处理",
  DONE: "已完成",
  DISMISSED: "已忽略",
};

export const agentOperationStatusLabels: Record<AgentOperationStatus, string> = {
  APPLIED: "已应用",
  PENDING_CONFIRMATION: "待确认",
  REJECTED: "已拒绝",
  FAILED: "未执行",
};

export function parseProjectStatus(value: FormDataEntryValue | null): ProjectStatus {
  if (value === "ACTIVE" || value === "PAUSED" || value === "ARCHIVED") {
    return value;
  }

  return "DRAFT";
}

export function parseProductStatus(value: FormDataEntryValue | null): ProductStatus {
  if (value === "ACTIVE" || value === "ARCHIVED") {
    return value;
  }

  return "DRAFT";
}

export function parseProductFactStatus(value: FormDataEntryValue | null): ProductFactStatus {
  if (value === "CONFIRMED" || value === "NEEDS_REVIEW") {
    return value;
  }

  return "DRAFT";
}
