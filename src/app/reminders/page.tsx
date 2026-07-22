import Link from "next/link";
import { AlertTriangle, Bell } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { listWorkspaceReminders } from "@/lib/data/content-workspace";
import { loadWorkspaceContextSafe } from "@/lib/page-context";
import { reminderSeverityLabels, reminderStatusLabels } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath="/reminders" context={null} contextError={error} returnTo="/reminders">
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  try {
    const reminders = await listWorkspaceReminders(context.currentWorkspace.id);

    return (
      <AppShell activePath="/reminders" context={context} returnTo="/reminders">
        <section className="page-header">
          <div>
            <h2>提醒中心</h2>
            <p className="muted">
              基于项目状态、计划缺口、活动风险和素材包状态沉淀提醒；飞书未来只是通知出口。
            </p>
          </div>
          <Link className="button" href="/b-agent">
            回到 Agent 工作台
          </Link>
        </section>

        {reminders.length > 0 ? (
          <section className="reminder-board">
            {reminders.map((reminder) => (
              <article className="reminder-card" key={reminder.id}>
                {reminder.severity === "INFO" ? (
                  <Bell size={18} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={18} aria-hidden="true" />
                )}
                <div>
                  <header>
                    <strong>{reminder.title}</strong>
                    <div className="tag-grid compact">
                      <StatusBadge
                        label={reminderSeverityLabels[reminder.severity]}
                        tone={reminder.severity === "INFO" ? "neutral" : "warning"}
                      />
                      <StatusBadge
                        label={reminderStatusLabels[reminder.status]}
                        tone={reminder.status === "DONE" ? "success" : "neutral"}
                      />
                    </div>
                  </header>
                  <p>{reminder.description ?? "暂无提醒说明。"}</p>
                  <small>{reminder.project ? `项目：${reminder.project.name}` : "Workspace 级提醒"}</small>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="panel">
            <EmptyState
              title="暂无提醒"
              description="生成计划和素材包后，系统会创建需要人工注意的事项。"
            />
          </section>
        )}
      </AppShell>
    );
  } catch (remindersError) {
    return (
      <AppShell activePath="/reminders" context={context} returnTo="/reminders">
        <ErrorState
          message={remindersError instanceof Error ? remindersError.message : "无法加载提醒中心。"}
        />
      </AppShell>
    );
  }
}
