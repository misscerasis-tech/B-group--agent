import { Link2Off, Settings } from "lucide-react";
import {
  createFeishuPlaceholderAction,
  createIntegrationMigrationRecordAction,
  disableIntegrationConnectionAction,
  testFeishuConnectionPlaceholderAction,
} from "@/app/actions/integration-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listWorkspaceIntegrations } from "@/lib/data/integrations";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { integrationProviderLabels, integrationStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/integrations" context={null} contextError={error} returnTo="/integrations">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const { connections, migrationRecords } = await listWorkspaceIntegrations(
      context.currentWorkspace.id,
    );

    return (
      <AppShell activePath="/integrations" context={context} returnTo="/integrations">
        <section className="page-header">
          <div>
            <h2>集成设置</h2>
            <p className="muted">
              飞书是 Workspace 级可插拔连接，只用于通知、简单审核和沉淀；核心业务不依赖飞书。
            </p>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h3>登记飞书连接占位</h3>
            <form action={createFeishuPlaceholderAction} className="form">
              <label className="form-row">
                <span className="field-label">连接名称</span>
                <input name="displayName" placeholder="例如：品牌增长团队飞书" required />
              </label>
              <label className="form-row">
                <span className="field-label">组织显示名</span>
                <input name="tenantDisplayName" placeholder="例如：某某品牌飞书组织" />
              </label>
              <label className="form-row">
                <span className="field-label">通知群名称</span>
                <input name="notificationTargetName" placeholder="例如：巴西上市项目群" />
              </label>
              <label className="form-row">
                <span className="field-label">沉淀位置</span>
                <input name="repositoryTargetName" placeholder="例如：内容增长沉淀文档" />
              </label>
              <label className="form-row">
                <span className="field-label">备注</span>
                <textarea name="notes" placeholder="本阶段不填写 App ID、Secret、tenant key 或群聊 ID。" />
              </label>
              <button className="button" type="submit">
                保存占位连接
              </button>
            </form>
          </div>

          <div className="panel">
            <h3>保存迁移记录</h3>
            <form action={createIntegrationMigrationRecordAction} className="form">
              <label className="form-row">
                <span className="field-label">关联连接</span>
                <select defaultValue="" name="connectionId">
                  <option value="">不关联具体连接</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span className="field-label">原目标</span>
                <input name="fromTargetName" placeholder="例如：旧飞书组织/旧通知群" />
              </label>
              <label className="form-row">
                <span className="field-label">新目标</span>
                <input name="toTargetName" placeholder="例如：新飞书组织/新通知群" />
              </label>
              <label className="form-row">
                <span className="field-label">迁移说明</span>
                <textarea
                  name="summary"
                  placeholder="说明为什么换绑、哪些通知群和沉淀位置需要重选。"
                  required
                />
              </label>
              <button className="button secondary" type="submit">
                保存迁移记录
              </button>
            </form>
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <div className="panel">
            <div className="section-title-row">
              <h3>Workspace 集成连接</h3>
              <Settings size={18} aria-hidden="true" />
            </div>
            {connections.length > 0 ? (
              <div className="card-list">
                {connections.map((connection) => (
                  <article className="item-card" key={connection.id}>
                    <header>
                      <h4>{connection.displayName}</h4>
                      <StatusBadge
                        label={integrationStatusLabels[connection.status]}
                        tone={connection.status === "CONNECTED" ? "success" : "neutral"}
                      />
                    </header>
                    <p>
                      {integrationProviderLabels[connection.provider]} ·{" "}
                      {connection.tenantDisplayName ?? "待选择组织"}
                    </p>
                    <p>
                      通知：{connection.notificationTargetName ?? "待选择"} · 沉淀：
                      {connection.repositoryTargetName ?? "待选择"}
                    </p>
                    <p>{connection.notes ?? "暂无备注"}</p>
                    <form
                      action={testFeishuConnectionPlaceholderAction}
                      className="inline-form"
                    >
                      <input name="connectionId" type="hidden" value={connection.id} />
                      <button className="button secondary" type="submit">
                        测试连接（占位）
                      </button>
                    </form>
                    {connection.status !== "DISABLED" ? (
                      <form action={disableIntegrationConnectionAction} className="inline-form">
                        <input name="connectionId" type="hidden" value={connection.id} />
                        <button className="button secondary" type="submit">
                          停用旧连接
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无集成连接" description="可以先保存飞书占位连接，后续再接真实授权。" />
            )}
          </div>

          <div className="panel">
            <div className="section-title-row">
              <h3>迁移记录</h3>
              <Link2Off size={18} aria-hidden="true" />
            </div>
            {migrationRecords.length > 0 ? (
              <div className="change-log-list">
                {migrationRecords.map((record) => (
                  <article className="change-log-item" key={record.id}>
                    <Link2Off size={16} aria-hidden="true" />
                    <div>
                      <strong>{record.summary}</strong>
                      <p>
                        {integrationProviderLabels[record.provider]} ·{" "}
                        {record.fromTargetName ?? "未填写原目标"} →{" "}
                        {record.toTargetName ?? "未填写新目标"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无迁移记录" description="更换飞书组织、通知群或沉淀位置时必须留痕。" />
            )}
          </div>
        </section>

        <section className="demo-footer-panel" style={{ marginTop: 16 }}>
          <Link2Off size={20} aria-hidden="true" />
          <p>
            本页面不会保存 App Secret。真实授权接入后，App ID、Secret、tenant key、chat ID、document ID、bitable ID
            都必须来自环境变量或加密配置，不得写死。
          </p>
        </section>
      </AppShell>
    );
  } catch (integrationsError) {
    return (
      <AppShell activePath="/integrations" context={context} returnTo="/integrations">
        <ErrorState
          message={
            integrationsError instanceof Error ? integrationsError.message : "无法加载集成设置。"
          }
        />
      </AppShell>
    );
  }
}
