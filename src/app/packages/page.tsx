import Link from "next/link";
import { CheckCircle2, Download, FileArchive, FileText, PlayCircle } from "lucide-react";
import {
  attachAssetToPackageFileAction,
  createContentPackageAction,
  submitContentPackageForReviewAction,
  updateContentPackageFileStatusAction,
} from "@/app/actions/package-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listWorkspaceAssets } from "@/lib/data/assets";
import { listWorkspaceContentPackages } from "@/lib/data/content-workspace";
import { listProjects } from "@/lib/data/projects";
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
    const [packages, projects, assets] = await Promise.all([
      listWorkspaceContentPackages(context.currentWorkspace.id),
      listProjects(context.currentWorkspace.id),
      listWorkspaceAssets(context.currentWorkspace.id),
    ]);
    const attachableAssets = assets.filter(
      (asset) => asset.status === "APPROVED" && asset.storagePath,
    );

    return (
      <AppShell activePath="/packages" context={context} returnTo="/packages">
        <section className="page-header">
          <div>
            <h2>素材包中心</h2>
            <p className="muted">
              当前阶段先提供本地 ZIP 可交付文件包；后续继续增强 PDF、XLSX、DOCX 和海报成品精排。
            </p>
          </div>
          <Link className="button" href="/b-agent">
            生成素材包结构
          </Link>
        </section>

        <section className="panel">
          <h3>新建素材包结构</h3>
          <form action={createContentPackageAction} className="form">
            <div className="grid two">
              <label className="form-row">
                <span className="field-label">项目</span>
                <select name="projectId" required>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">频率</span>
                <select defaultValue="WEEKLY" name="frequency">
                  <option value="WEEKLY">每周一次</option>
                  <option value="BIWEEKLY">每两周一次</option>
                  <option value="MONTHLY">每月一次</option>
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">素材包名称</span>
                <input name="name" placeholder="例如：8 月第 1 周 TikTok 素材包" required />
              </label>
              <label className="form-row">
                <span className="field-label">周期</span>
                <input name="period" placeholder="例如：2026-08 第1周" required />
              </label>
            </div>
            <label className="form-row">
              <span className="field-label">说明</span>
              <textarea name="summary" placeholder="说明目标市场、渠道、主题或审核重点。" />
            </label>
            <button className="button" disabled={projects.length === 0} type="submit">
              <FileArchive size={16} aria-hidden="true" />
              创建素材包
            </button>
            {projects.length === 0 ? <p className="muted">请先在项目中心创建项目。</p> : null}
          </form>
        </section>

        {packages.length > 0 ? (
          <section className="package-list" style={{ marginTop: 16 }}>
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
                          {file.asset ? ` · 已关联：${file.asset.name}` : ""}
                        </small>
                      </span>
                      {!file.asset && attachableAssets.length > 0 ? (
                        <form action={attachAssetToPackageFileAction} className="inline-form">
                          <input name="fileId" type="hidden" value={file.id} />
                          <select aria-label="选择关联素材" name="assetId" required>
                            {attachableAssets.map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.name}
                              </option>
                            ))}
                          </select>
                          <button className="button secondary" type="submit">
                            关联素材
                          </button>
                        </form>
                      ) : null}
                      {file.asset?.storagePath ? (
                        <Link
                          className="button secondary"
                          href={`/assets/${file.asset.id}/download`}
                        >
                          下载关联素材
                        </Link>
                      ) : null}
                      <form action={updateContentPackageFileStatusAction} className="inline-form">
                        <input name="fileId" type="hidden" value={file.id} />
                        {file.status === "PLANNED" ? (
                          <button
                            className="button secondary"
                            name="status"
                            type="submit"
                            value="GENERATED"
                          >
                            <PlayCircle size={16} aria-hidden="true" />
                            已生成
                          </button>
                        ) : null}
                        {file.status !== "APPROVED" ? (
                          <button className="button" name="status" type="submit" value="APPROVED">
                            <CheckCircle2 size={16} aria-hidden="true" />
                            通过
                          </button>
                        ) : null}
                      </form>
                    </div>
                  ))}
                </div>
                <div className="download-preview">
                  <Download size={18} aria-hidden="true" />
                  <span>可下载包含 PDF、XLSX、DOCX、TXT、关联素材和 manifest 的 ZIP。</span>
                  {contentPackage.status !== "APPROVED" ? (
                    <form action={submitContentPackageForReviewAction} className="inline-form">
                      <input name="contentPackageId" type="hidden" value={contentPackage.id} />
                      <input name="returnTo" type="hidden" value="/packages" />
                      <button className="button" type="submit">
                        <CheckCircle2 size={16} aria-hidden="true" />
                        提交审核
                      </button>
                    </form>
                  ) : null}
                  <Link className="button secondary" href={`/packages/${contentPackage.id}/export`}>
                    下载素材包
                  </Link>
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
