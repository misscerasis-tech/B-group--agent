import { Image as ImageIcon, Layers, Sparkles } from "lucide-react";
import {
  approveAssetAction,
  createTemplateCompositionJobAction,
  rejectAssetAction,
  uploadAssetAction,
} from "@/app/actions/asset-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  listWorkspaceAssets,
  listWorkspaceImageJobs,
  listWorkspaceImageProviderConfigs,
} from "@/lib/data/assets";
import { listProducts } from "@/lib/data/products";
import { listProjects } from "@/lib/data/projects";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import {
  assetKindLabels,
  assetSourceLabels,
  assetStatusLabels,
  imageGenerationModeLabels,
  imageGenerationStatusLabels,
} from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/assets" context={null} contextError={error} returnTo="/assets">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const [assets, imageJobs, providerConfigs, projects, products] = await Promise.all([
      listWorkspaceAssets(context.currentWorkspace.id),
      listWorkspaceImageJobs(context.currentWorkspace.id),
      listWorkspaceImageProviderConfigs(context.currentWorkspace.id),
      listProjects(context.currentWorkspace.id),
      listProducts(context.currentWorkspace.id),
    ]);
    const approvedProductImages = assets.filter(
      (asset) => asset.kind === "PRODUCT_IMAGE" && asset.status === "APPROVED",
    );
    const approvedLogos = assets.filter(
      (asset) => asset.kind === "LOGO" && asset.status === "APPROVED",
    );

    return (
      <AppShell activePath="/assets" context={context} returnTo="/assets">
        <section className="page-header">
          <div>
            <h2>素材库</h2>
            <p className="muted">
              保存真实产品图、官方 Logo、产品资料和生成结果；正式海报必须引用已审核真实素材。
            </p>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h3>上传素材</h3>
            <form action={uploadAssetAction} className="form">
              <label className="form-row">
                <span className="field-label">素材名称</span>
                <input name="name" placeholder="例如：Aurora Cup 产品主图" required />
              </label>
              <label className="form-row">
                <span className="field-label">素材类型</span>
                <select defaultValue="PRODUCT_IMAGE" name="kind">
                  <option value="PRODUCT_IMAGE">真实产品图</option>
                  <option value="LOGO">官方 Logo</option>
                  <option value="DOCUMENT">产品资料</option>
                  <option value="REFERENCE_IMAGE">参考图</option>
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">关联项目</span>
                <select defaultValue="" name="projectId">
                  <option value="">不关联项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">关联产品</span>
                <select defaultValue="" name="productId">
                  <option value="">不关联产品</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">文件</span>
                <input name="file" required type="file" />
              </label>
              <button className="button" type="submit">
                上传到本地素材库
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="section-title-row">
              <h3>图片生成供应商候选</h3>
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div className="card-list">
              {providerConfigs.map((config) => (
                <article className="item-card" key={config.id}>
                  <header>
                    <h4>{config.displayName}</h4>
                    <StatusBadge label={config.enabled ? "已启用" : "未启用"} tone="neutral" />
                  </header>
                  <p>
                    {config.provider} · {config.defaultModel ?? "待配置模型"}
                  </p>
                  <p>{config.capabilities.join("、") || "暂无能力声明"}</p>
                </article>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0" }} />

            <h3>创建模板化合成任务</h3>
            <form action={createTemplateCompositionJobAction} className="form">
              <label className="form-row">
                <span className="field-label">关联项目</span>
                <select defaultValue="" name="projectId">
                  <option value="">不关联项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">Product Layer</span>
                <select name="productImageAssetId" required>
                  <option value="">选择已审核真实产品图</option>
                  {approvedProductImages.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">Logo Layer</span>
                <select name="logoAssetId" required>
                  <option value="">选择已审核官方 Logo</option>
                  {approvedLogos.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">画布比例</span>
                <select defaultValue="4:5" name="aspectRatio">
                  <option value="4:5">Instagram / Facebook 4:5</option>
                  <option value="1:1">通用方图 1:1</option>
                  <option value="9:16">TikTok / Reels 9:16</option>
                  <option value="16:9">横版 16:9</option>
                </select>
              </label>
              <button
                className="button"
                disabled={approvedProductImages.length === 0 || approvedLogos.length === 0}
                type="submit"
              >
                <Layers size={16} aria-hidden="true" />
                创建任务
              </button>
              {approvedProductImages.length === 0 || approvedLogos.length === 0 ? (
                <p className="muted">需要先审核通过至少一张真实产品图和一个官方 Logo。</p>
              ) : null}
            </form>
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <div className="panel">
            <div className="section-title-row">
              <h3>素材列表</h3>
              <StatusBadge label={`${assets.length} 个素材`} tone="neutral" />
            </div>
            {assets.length > 0 ? (
              <div className="card-list">
                {assets.map((asset) => (
                  <article className="item-card" key={asset.id}>
                    <header>
                      <h4>{asset.name}</h4>
                      <StatusBadge
                        label={assetStatusLabels[asset.status]}
                        tone={asset.status === "APPROVED" ? "success" : "warning"}
                      />
                    </header>
                    <p>
                      {assetKindLabels[asset.kind]} · {assetSourceLabels[asset.source]} ·{" "}
                      {asset.mimeType ?? "未知类型"}
                    </p>
                    <p>
                      {asset.product ? `产品：${asset.product.name}` : "未关联产品"} ·{" "}
                      {asset.project ? `项目：${asset.project.name}` : "未关联项目"}
                    </p>
                    {asset.storagePath ? <small>{asset.storagePath}</small> : null}
                    {asset.status !== "APPROVED" ? (
                      <form action={approveAssetAction} className="inline-form">
                        <input name="assetId" type="hidden" value={asset.id} />
                        <button className="button secondary" type="submit">
                          标记为已审核
                        </button>
                      </form>
                    ) : null}
                    {asset.status === "UPLOADED" ? (
                      <form action={rejectAssetAction} className="inline-form">
                        <input name="assetId" type="hidden" value={asset.id} />
                        <button className="button secondary" type="submit">
                          拒绝素材
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无素材" description="上传产品图、Logo 或资料后会显示在这里。" />
            )}
          </div>

          <div className="panel">
            <div className="section-title-row">
              <h3>图片生成任务</h3>
              <Layers size={18} aria-hidden="true" />
            </div>
            {imageJobs.length > 0 ? (
              <div className="card-list">
                {imageJobs.map((job) => (
                  <article className="item-card" key={job.id}>
                    <header>
                      <h4>{imageGenerationModeLabels[job.generationMode]}</h4>
                      <StatusBadge
                        label={imageGenerationStatusLabels[job.status]}
                        tone={job.status === "SUCCEEDED" ? "success" : "neutral"}
                      />
                    </header>
                    <p>
                      {job.provider} · {job.model ?? "未指定模型"} · {job.aspectRatio}
                    </p>
                    <p>
                      来源素材 {job.sourceAssetIds.length} 个 · promptVersion {job.promptVersion}
                    </p>
                    {job.error ? <p>{job.error}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="暂无图片生成任务"
                description="V1 先做模板化合成任务记录，V1.5 再接 AI 背景生成。"
              />
            )}
          </div>
        </section>

        <section className="demo-footer-panel" style={{ marginTop: 16 }}>
          <ImageIcon size={20} aria-hidden="true" />
          <p>
            产品图和 Logo 只有审核通过后才能进入 Product Layer 与 Logo Layer；图片模型不得重绘或静默替换真实产品主体。
          </p>
        </section>
      </AppShell>
    );
  } catch (assetsError) {
    return (
      <AppShell activePath="/assets" context={context} returnTo="/assets">
        <ErrorState
          message={assetsError instanceof Error ? assetsError.message : "无法加载素材库。"}
        />
      </AppShell>
    );
  }
}
