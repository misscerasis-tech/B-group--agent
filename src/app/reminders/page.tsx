import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import {
  createProactiveRemindersAction,
  resolveReminderAction,
} from "@/app/actions/reminder-actions";
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
          <div className="hero-actions">
            <form action={createProactiveRemindersAction} className="inline-form">
              <button className="button" type="submit">
                <RefreshCw size={16} aria-hidden="true" />
                生成主动提醒
              </button>
            </form>
            <Link className="button secondary" href="/b-agent">
              回到 Agent 工作台
            </Link>
          </div>
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
                  <small>
                    {reminder.project ? `项目：${reminder.project.name}` : "Workspace 级提醒"}
                  </small>
                  {reminder.status === "OPEN" ? (
                    <form action={resolveReminderAction} className="inline-form">
                      <input name="reminderId" type="hidden" value={reminder.id} />
                      <button className="button secondary" name="status" type="submit" value="DONE">
                        <CheckCircle2 size={16} aria-hidden="true" />
                        标记完成
                      </button>
                      <button
                        className="button secondary"
                        name="status"
                        type="submit"
                        value="DISMISSED"
                      >
                        <XCircle size={16} aria-hidden="true" />
                        忽略
                      </button>
                    </form>
                  ) : null}
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
