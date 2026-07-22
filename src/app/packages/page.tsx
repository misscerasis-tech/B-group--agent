import Link from "next/link";
import { Download, FileArchive, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listWorkspaceContentPackages } from "@/lib/data/content-workspace";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import {
  contentFrequencyLabels,
  contentPackageStatusLabels,
  packageFileStatusLabels,
} from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/packages" context={null} contextError={error} returnTo="/packages">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const packages = await listWorkspaceContentPackages(context.currentWorkspace.id);

    return (
      <AppShell activePath="/packages" context={context} returnTo="/packages">
        <section className="page-header">
          <div>
            <h2>素材包中心</h2>
            <p className="muted">
              当前阶段先保存素材包结构和文件状态；后续接入真实 PDF、XLSX、DOCX、TXT、PNG、ZIP 导出。
            </p>
          </div>
          <Link className="button" href="/b-agent">
            生成素材包结构
          </Link>
        </section>

        {packages.length > 0 ? (
          <section className="package-list">
            {packages.map((contentPackage) => (
              <article className="package-card" key={contentPackage.id}>
                <header>
                  <div className="package-summary compact">
                    <FileArchive size={20} aria-hidden="true" />
                    <div>
                      <strong>{contentPackage.name}</strong>
                      <p>
                        {contentPackage.project.name} · {contentPackage.period} ·{" "}
                        {contentFrequencyLabels[contentPackage.frequency]}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    label={contentPackageStatusLabels[contentPackage.status]}
                    tone={contentPackage.status === "APPROVED" ? "success" : "neutral"}
                  />
                </header>
                <p className="muted">{contentPackage.summary ?? "暂无素材包说明。"}</p>
                <div className="pack-grid">
                  {contentPackage.files.map((file) => (
                    <div className="pack-file" key={file.id}>
                      <FileText size={18} aria-hidden="true" />
                      <span>
                        {file.name}
                        <small>
                          {file.fileType} · {packageFileStatusLabels[file.status]}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="download-preview">
                  <Download size={18} aria-hidden="true" />
                  <span>真实下载会在文件生成阶段开放，当前保留完整清单和审核状态。</span>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="panel">
            <EmptyState
              title="还没有素材包"
              description="进入 B组 Agent，先生成首月计划和第一份素材包结构。"
            />
          </section>
        )}
      </AppShell>
    );
  } catch (packagesError) {
    return (
      <AppShell activePath="/packages" context={context} returnTo="/packages">
        <ErrorState
          message={packagesError instanceof Error ? packagesError.message : "无法加载素材包中心。"}
        />
      </AppShell>
    );
  }
}
