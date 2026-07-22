import {
  buildProjectSnapshotJson,
  getProjectSnapshotExportData,
} from "@/lib/export/project-snapshot";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

type ProjectSnapshotRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: ProjectSnapshotRouteProps) {
  const { id } = await params;
  const context = await getWorkspaceContext();
  const snapshotData = await getProjectSnapshotExportData(context.currentWorkspace.id, id);

  if (!snapshotData) {
    return new Response("未找到当前 Workspace 下的项目。", {
      status: 404,
    });
  }

  const json = buildProjectSnapshotJson(snapshotData);
  const filename = `b-agent-project-snapshot-${id}.json`;

  return new Response(json, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
