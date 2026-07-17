import type { ProductStatus, ProjectStatus, WorkspaceRole } from "@prisma/client";

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

