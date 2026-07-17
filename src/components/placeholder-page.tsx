import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/ui/error-state";
import { loadWorkspaceContextSafe } from "@/lib/page-context";

type PlaceholderPageProps = {
  activePath: string;
  title: string;
  description: string;
  nextSteps: string[];
};

export async function PlaceholderPage({
  activePath,
  title,
  description,
  nextSteps,
}: PlaceholderPageProps) {
  const { context, error } = await loadWorkspaceContextSafe();

  if (!context) {
    return (
      <AppShell activePath={activePath} context={null} contextError={error} returnTo={activePath}>
        <ErrorState message={error ?? "无法加载演示 Workspace。"} />
      </AppShell>
    );
  }

  return (
    <AppShell activePath={activePath} context={context} returnTo={activePath}>
      <section className="page-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </section>

      <section className="panel">
        <h3>后续阶段开放</h3>
        <ol className="placeholder-steps">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}

