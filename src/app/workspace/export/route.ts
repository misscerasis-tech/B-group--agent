import {
  buildWorkspaceBackupJson,
  getWorkspaceBackupExportData,
} from "@/lib/export/workspace-backup";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getWorkspaceContext();
  const exportData = await getWorkspaceBackupExportData(context.currentWorkspace.id);

  if (!exportData) {
    return new Response("未找到当前 Workspace。", {
      status: 404,
    });
  }

  const json = buildWorkspaceBackupJson(exportData);
  const filename = `b-agent-workspace-backup-${context.currentWorkspace.slug}.json`;

  return new Response(json, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
