import {
  buildContentPackageZip,
  getContentPackageExportData,
} from "@/lib/export/package-export";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

type PackageExportRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: PackageExportRouteProps) {
  const { id } = await params;
  const context = await getWorkspaceContext();
  const exportData = await getContentPackageExportData(context.currentWorkspace.id, id);

  if (!exportData) {
    return new Response("未找到当前 Workspace 下的素材包。", {
      status: 404,
    });
  }

  const zip = await buildContentPackageZip(exportData);
  const filename = `b-agent-content-package-${id}.zip`;

  return new Response(zip, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Content-Length": String(zip.length),
      "Content-Type": "application/zip",
    },
  });
}
