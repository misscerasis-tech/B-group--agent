import Link from "next/link";
import {
  Bell,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  FolderKanban,
  Image,
  LayoutDashboard,
  PackageCheck,
  Settings,
  Sparkles,
} from "lucide-react";
import { switchWorkspaceAction } from "@/app/actions/workspace-actions";
import type { WorkspaceContext } from "@/lib/workspace-context";
import { workspaceRoleLabels } from "@/lib/status";

type AppShellProps = {
  activePath: string;
  returnTo: string;
  context: WorkspaceContext | null;
  contextError?: string | null;
  children: React.ReactNode;
};

const navItems = [
  { href: "/b-agent", label: "B组 Agent", icon: Sparkles },
  { href: "/dashboard", label: "今日工作台", icon: LayoutDashboard },
  { href: "/projects", label: "项目中心", icon: FolderKanban },
  { href: "/brain", label: "产品大脑", icon: Boxes },
  { href: "/assets", label: "素材库", icon: Image },
  { href: "/calendar", label: "内容日历", icon: CalendarDays },
  { href: "/packages", label: "素材包", icon: PackageCheck },
  { href: "/reviews", label: "审核中心", icon: ClipboardCheck },
  { href: "/reminders", label: "提醒中心", icon: Bell },
  { href: "/recaps", label: "数据复盘", icon: ChartNoAxesCombined },
  { href: "/integrations", label: "集成设置", icon: Settings },
];

export function AppShell({
  activePath,
  returnTo,
  context,
  contextError,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span>
            <strong>AI 内容增长</strong>
            <small>Agent V1</small>
          </span>
        </Link>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activePath === item.href;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "nav-item active" : "nav-item"}
                href={item.href}
                key={item.href}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">Web-first, Feishu-connected</p>
            <h1>中文内容增长工作台</h1>
          </div>

          <div className="topbar-actions">
            {context ? (
              <>
                <form action={switchWorkspaceAction} className="workspace-switcher">
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <label className="field-label compact" htmlFor="workspaceSlug">
                    Workspace
                  </label>
                  <select
                    aria-label="切换 Workspace"
                    defaultValue={context.currentWorkspace.slug}
                    id="workspaceSlug"
                    name="workspaceSlug"
                  >
                    {context.workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.slug}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                  <button className="button secondary" type="submit">
                    切换
                  </button>
                </form>

                <div className="user-pill">
                  <span>{context.user.name}</span>
                  <small>{workspaceRoleLabels[context.currentRole]}</small>
                </div>
              </>
            ) : (
              <div className="setup-warning">{contextError ?? "等待初始化"}</div>
            )}
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
