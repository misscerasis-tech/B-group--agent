import { readFile, stat } from "node:fs/promises";
import {
  getWorkspaceAssetForDownload,
  resolveLocalAssetPath,
} from "@/lib/data/assets";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

type AssetDownloadRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: AssetDownloadRouteProps) {
  const { id } = await params;
  const context = await getWorkspaceContext();
  const asset = await getWorkspaceAssetForDownload(context.currentWorkspace.id, id);

  if (!asset || !asset.storagePath) {
    return new Response("未找到当前 Workspace 下的素材文件。", {
      status: 404,
    });
  }

  try {
    const absolutePath = resolveLocalAssetPath(asset.storagePath);
    const [file, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const filename = asset.originalFilename ?? `${asset.name}.${asset.kind.toLowerCase()}`;

    return new Response(file, {
      headers: {
        "Content-Disposition": `attachment; filename="${sanitizeDownloadFilename(
          filename,
        )}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(fileStat.size),
        "Content-Type": asset.mimeType ?? "application/octet-stream",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "无法读取本地素材文件。",
      {
        status: 404,
      },
    );
  }
}

function sanitizeDownloadFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, "_");
}
