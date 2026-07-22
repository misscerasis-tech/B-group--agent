import {
  buildWorkspaceRecapSnapshotJson,
  getWorkspaceRecapExportData,
} from "@/lib/export/recap-snapshot";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getWorkspaceContext();
  const exportData = await getWorkspaceRecapExportData(context.currentWorkspace.id);

  if (!exportData) {
    return new Response("未找到当前 Workspace。", {
      status: 404,
    });
  }

  const json = buildWorkspaceRecapSnapshotJson(exportData);
  const filename = `b-agent-workspace-recap-${context.currentWorkspace.slug}.json`;

  return new Response(json, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
