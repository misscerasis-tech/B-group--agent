import Link from "next/link";
import { Activity, Database, TerminalSquare } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { checkRuntimeHealth } from "@/lib/runtime-health";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const health = await checkRuntimeHealth();

  return (
    <AppShell activePath="/setup" context={null} returnTo="/setup">
      <section className="page-header">
        <div>
          <h2>B 组本地运行诊断</h2>
          <p className="muted">
            用来确认 Web 服务、环境变量和数据库连接是否准备好；不会显示任何密钥或数据库密码。
          </p>
        </div>
        <div className="hero-actions">
          {health.ok ? (
            <Link className="button" href="/b-agent">
              打开 B组 Agent
            </Link>
          ) : null}
          <Link className="button secondary" href="/api/health">
            查看 JSON
          </Link>
        </div>
      </section>

      <section className="grid three">
        <article className="panel stat">
          <span className="muted">Web 服务</span>
          <strong>{health.service}</strong>
          <StatusBadge label="已启动" tone="success" />
        </article>
        <article className="panel stat">
          <span className="muted">数据库</span>
          <strong>{health.database.status === "ok" ? "可连接" : "不可用"}</strong>
          <StatusBadge label={health.database.status === "ok" ? "正常" : "需处理"} tone={health.database.status === "ok" ? "success" : "warning"} />
        </article>
        <article className="panel stat">
          <span className="muted">AI Provider</span>
          <strong>{health.environment.aiProvider}</strong>
          <StatusBadge
            label={health.environment.aiProvider === "local-rule" ? "本地规则" : "已降级"}
            tone={health.environment.aiProvider === "local-rule" ? "neutral" : "warning"}
          />
        </article>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <article className="panel">
          <h3>
            <Database size={18} aria-hidden="true" /> 数据库与环境
          </h3>
          <ul className="clean-list">
            <li>DATABASE_URL：{health.environment.databaseUrl === "configured" ? "已配置" : "缺失"}</li>
            <li>素材存储目录：{health.environment.assetStorageDir === "configured" ? "自定义" : "使用默认 storage/assets"}</li>
            <li>检查时间：{health.checkedAt}</li>
          </ul>
          {health.database.message ? <p className="muted">{health.database.message}</p> : null}
        </article>

        <article className="panel">
          <h3>
            <Activity size={18} aria-hidden="true" /> 下一步
          </h3>
          <ol className="clean-list">
            {health.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h3>
          <TerminalSquare size={18} aria-hidden="true" /> 常用命令
        </h3>
        <ul className="clean-list">
          <li>安装依赖：npx pnpm@10.13.1 install</li>
          <li>检查环境：npx pnpm@10.13.1 run doctor</li>
          <li>启动数据库：npx pnpm@10.13.1 run docker:up</li>
          <li>迁移数据库：npx pnpm@10.13.1 run db:migrate</li>
          <li>写入演示数据：npx pnpm@10.13.1 run db:seed</li>
          <li>启动 B 组：npx pnpm@10.13.1 run dev:b</li>
        </ul>
      </section>
    </AppShell>
  );
}
