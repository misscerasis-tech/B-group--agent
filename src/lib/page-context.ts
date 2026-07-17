import { getWorkspaceContext } from "@/lib/workspace-context";

export async function loadWorkspaceContextSafe() {
  try {
    return {
      context: await getWorkspaceContext(),
      error: null,
    };
  } catch (error) {
    return {
      context: null,
      error: error instanceof Error ? error.message : "无法加载当前 Workspace。",
    };
  }
}

