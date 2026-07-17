import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="state-box">
      <Inbox size={24} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

