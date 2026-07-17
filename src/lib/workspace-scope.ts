export function assertWorkspaceId(workspaceId: string) {
  if (!workspaceId || workspaceId.trim().length === 0) {
    throw new Error("缺少当前 Workspace，无法访问业务数据。");
  }
}

export function scopedWhere<TWhere extends Record<string, unknown>>(
  workspaceId: string,
  where?: TWhere,
) {
  assertWorkspaceId(workspaceId);

  return {
    ...where,
    workspaceId,
  } as TWhere & { workspaceId: string };
}
