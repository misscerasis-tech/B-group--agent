import type {
  AgentOperationStatus,
  AssetKind,
  AssetSource,
  AssetStatus,
  ContentFrequency,
  ContentPackageStatus,
  ImageGenerationMode,
  ImageGenerationStatus,
  IntegrationProvider,
  IntegrationStatus,
  PackageFileStatus,
  PlanItemStatus,
  ProductFactStatus,
  ProductStatus,
  ProjectStatus,
  ReminderSeverity,
  ReminderStatus,
  ReviewSubjectType,
  ReviewTaskStatus,
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

export const reviewTaskStatusLabels: Record<ReviewTaskStatus, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  CHANGES_REQUESTED: "需修改",
  CANCELED: "已取消",
};

export const reviewSubjectTypeLabels: Record<ReviewSubjectType, string> = {
  PRODUCT_FACT: "产品事实",
  PROJECT_STRATEGY: "项目策略",
  CONTENT_PACKAGE: "素材包",
  ASSET: "素材",
};

export const agentOperationStatusLabels: Record<AgentOperationStatus, string> = {
  APPLIED: "已应用",
  PENDING_CONFIRMATION: "待确认",
  REJECTED: "已拒绝",
  FAILED: "未执行",
};

export const assetKindLabels: Record<AssetKind, string> = {
  PRODUCT_IMAGE: "真实产品图",
  LOGO: "官方 Logo",
  DOCUMENT: "产品资料",
  REFERENCE_IMAGE: "参考图",
  GENERATED_IMAGE: "生成图片",
  EXPORT_FILE: "导出文件",
};

export const assetSourceLabels: Record<AssetSource, string> = {
  USER_UPLOAD: "用户上传",
  GENERATED: "系统生成",
  IMPORTED: "导入记录",
};

export const assetStatusLabels: Record<AssetStatus, string> = {
  UPLOADED: "待审核",
  APPROVED: "已审核",
  REJECTED: "已拒绝",
  ARCHIVED: "已归档",
};

export const imageGenerationModeLabels: Record<ImageGenerationMode, string> = {
  TEMPLATE_COMPOSITION: "模板化合成",
  BACKGROUND_GENERATION: "背景生成",
  IMAGE_EDIT: "图片编辑",
  IMAGE_EXPAND: "画布扩展",
};

export const imageGenerationStatusLabels: Record<ImageGenerationStatus, string> = {
  QUEUED: "排队中",
  RUNNING: "生成中",
  SUCCEEDED: "已成功",
  FAILED: "已失败",
  CANCELED: "已取消",
};

export const integrationProviderLabels: Record<IntegrationProvider, string> = {
  FEISHU: "飞书",
};

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  CONNECTED: "已连接",
  DISABLED: "已停用",
  NEEDS_RECONNECT: "待连接",
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

export function parseAssetKind(value: FormDataEntryValue | null): AssetKind {
  if (
    value === "LOGO" ||
    value === "DOCUMENT" ||
    value === "REFERENCE_IMAGE" ||
    value === "GENERATED_IMAGE" ||
    value === "EXPORT_FILE"
  ) {
    return value;
  }

  return "PRODUCT_IMAGE";
}

export function parsePlanItemStatus(value: FormDataEntryValue | null): PlanItemStatus {
  if (value === "DRAFT" || value === "REVIEW_NEEDED" || value === "DONE") {
    return value;
  }

  return "READY";
}
