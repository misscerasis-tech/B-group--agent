import { CircleAlert } from "lucide-react";

type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title = "无法加载数据", message }: ErrorStateProps) {
  return (
    <div className="state-box error">
      <CircleAlert size={24} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      <p className="muted">
        如果这是首次启动，请在项目目录运行 `npx pnpm@10.13.1 run doctor`，再确认
        PostgreSQL 已运行，并执行数据库迁移和 seed。
      </p>
      <p className="muted">
        数据库排障可打开 `/api/health`；如果 3002 被其他小组占用，请改用 3003 启动 B 组。
      </p>
    </div>
  );
}
