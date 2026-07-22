import Link from "next/link";
import {
  createProjectAction,
  kickoffProjectFromBriefAction,
} from "@/app/actions/project-actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listProjects } from "@/lib/data/projects";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { projectStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/projects" context={null} contextError={error} returnTo="/projects">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const projects = await listProjects(context.currentWorkspace.id);

    return (
      <AppShell activePath="/projects" context={context} returnTo="/projects">
        <section className="page-header">
          <div>
            <h2>项目中心</h2>
            <p className="muted">
              项目属于当前 Workspace，后续策略、素材包和复盘都会挂在项目下。
            </p>
          </div>
        </section>

        <section className="panel">
          <h3>中文 Brief 启动项目</h3>
          <form action={kickoffProjectFromBriefAction} className="form">
            <div className="grid two">
              <label className="form-row">
                <span className="field-label">项目名称</span>
                <input name="projectName" placeholder="例如：巴西新品首月内容增长" required />
              </label>
              <label className="form-row">
                <span className="field-label">产品名称</span>
                <input name="productName" placeholder="例如：Aurora Cup 智能保温杯" required />
              </label>
            </div>
            <label className="form-row">
              <span className="field-label">中文启动 Brief</span>
              <textarea
                name="brief"
                placeholder="例如：这是一款 600ml 不锈钢保温杯，24 小时保温，主推巴西市场，新增 TikTok 和 Instagram，每周生成一次素材包，世界杯和通勤场景优先。"
                required
              />
            </label>
            <button className="button" type="submit">
              创建并进入 B组 Agent
            </button>
          </form>
        </section>

        <section className="grid two">
          <div className="panel">
            <h3>新建项目</h3>
            <form action={createProjectAction} className="form">
              <label className="form-row">
                <span className="field-label">项目名称</span>
                <input name="name" placeholder="例如：巴西新品上市首月增长" required />
              </label>
              <label className="form-row">
                <span className="field-label">项目说明</span>
                <textarea name="description" placeholder="说明目标市场、阶段目标或核心渠道。" />
              </label>
              <label className="form-row">
                <span className="field-label">项目状态</span>
                <select defaultValue="DRAFT" name="status">
                  <option value="DRAFT">草稿</option>
                  <option value="ACTIVE">进行中</option>
                  <option value="PAUSED">暂停</option>
                  <option value="ARCHIVED">已归档</option>
                </select>
              </label>
              <button className="button" type="submit">
                创建项目
              </button>
            </form>
          </div>

          <div className="panel">
            <h3>项目列表</h3>
            {projects.length > 0 ? (
              <div className="card-list">
                {projects.map((project) => (
                  <Link className="item-card" href={`/projects/${project.id}`} key={project.id}>
                    <header>
                      <h4>{project.name}</h4>
                      <StatusBadge
                        label={projectStatusLabels[project.status]}
                        tone={project.status === "ACTIVE" ? "success" : "neutral"}
                      />
                    </header>
                    <p>{project.description ?? "暂无项目说明"}</p>
                    <p>
                      已关联 {project.projectProducts.length} 个产品
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有项目" description="创建项目后，就可以进入顾问式启动流程。" />
            )}
          </div>
        </section>
      </AppShell>
    );
  } catch (projectsError) {
    return (
      <AppShell activePath="/projects" context={context} returnTo="/projects">
        <ErrorState
          message={projectsError instanceof Error ? projectsError.message : "无法加载项目中心。"}
        />
      </AppShell>
    );
  }
}
