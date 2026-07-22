import Link from "next/link";

const groups = [
  {
    name: "A组",
    title: "AI 电商运营 Agent",
    description: "电商运营、店铺复盘、飞书任务与运营建议。请放在 A 组独立路由或独立服务中。",
    href: "/a-agent",
    status: "独立预留",
  },
  {
    name: "B组",
    title: "AI 内容增长 Agent",
    description: "新品品牌、多产品、多市场的内容增长负责人。本仓库当前稳定入口。",
    href: "/b-agent",
    status: "当前可用",
  },
  {
    name: "C组",
    title: "待定义 Agent",
    description: "后续 C 组 Agent 使用独立路由，避免占用 A/B 入口。",
    href: "/c-agent",
    status: "后续开放",
  },
];

export default function AgentIndexPage() {
  return (
    <main className="group-index">
      <section className="group-index-header">
        <p className="eyebrow">AI赛 · ABC 三组入口</p>
        <h1>请选择对应小组 Agent</h1>
        <p>
          `/agent` 是分组入口，不属于任何单一小组。A、B、C 三组必须使用独立路径，避免互相覆盖。
        </p>
      </section>

      <section className="group-card-grid" aria-label="小组 Agent 列表">
        {groups.map((group) => (
          <article className="group-card" key={group.name}>
            <div className="group-card-topline">
              <span>{group.name}</span>
              <small>{group.status}</small>
            </div>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            {group.name === "B组" ? (
              <Link className="button" href={group.href}>
                进入 B组 Agent
              </Link>
            ) : (
              <span className="button disabled">{group.href}</span>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

