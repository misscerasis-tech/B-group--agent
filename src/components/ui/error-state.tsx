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
        如果这是首次启动，请确认 PostgreSQL 已运行，并执行数据库迁移和 seed。
      </p>
    </div>
  );
}

