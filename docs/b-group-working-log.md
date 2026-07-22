# B 组工作助手开发日志

## 当前分支

- `feature/b-group-working-assistant`
- 远程仓库：`misscerasis-tech/B-group--agent.git`
- 当前最新提交：以 `git log -1 --oneline` 为准；本分支正在持续推进，不合并 `main`，不创建 tag。

## 当前环境提示

- 本机 Node.js 与 pnpm 可用。
- 当前机器未检测到 `docker` 命令；本地 PostgreSQL 仍需要用户安装并启动 Docker Desktop，或提供可用的外部 PostgreSQL `DATABASE_URL`。
- 当前 3002 端口曾被其他进程占用；B 组推荐使用 `npx pnpm@10.13.1 run dev:b`，若端口冲突则改用 `npx pnpm@10.13.1 exec next dev -p 3003`。
- `/api/health` 可用于确认 Web 进程和数据库连接状态。
- `npx pnpm@10.13.1 run doctor` 可检查当前目录、Git 分支、Node、pnpm、Docker、`.env` 和 3002 端口占用。

## 已推送能力概览

- 数据库驱动的 `/b-agent` 工作台：中文对话 + 结构化项目工作台。
- Workspace 创建、切换和多 Workspace 数据隔离。
- 项目、产品、产品事实、策略、计划、素材包、审核、提醒、复盘和集成占位数据模型。
- 本地规则型中文指令：市场、渠道、客群、内容方向、素材包频率、项目状态和提醒创建。
- 正式策略二次确认、拒绝变更和策略版本历史。
- 项目/产品手工操作、Agent 操作、素材、提醒、集成和指标录入的变更日志。
- 素材库上传校验、自动审核任务、素材状态同步和模板化合成任务记录。
- 素材包 ZIP 可交付文件包导出、项目工作台 JSON 快照导出和 Workspace 复盘 JSON 快照导出。
- 内容日历状态推进、首月计划截止日期。
- 提醒中心主动提醒、手动提醒、完成/忽略。
- 数据复盘指标录入、CTR、点击转化率、单次转化成本和可下载复盘快照。
- 飞书占位连接、占位测试、停用旧连接和迁移记录。
- 图片生成产品主体锁定护栏测试。
- 素材包中心支持手动创建 11 项素材包结构、提交 Web 审核、审核任务联动和 ZIP 可交付文件包导出。
- 项目中心支持中文 Brief 启动项目，一次创建项目、产品、关联、待确认事实、策略草案、对话和变更日志。

## 最近完整验证

每个功能提交前均运行过：

```bash
npx pnpm@10.13.1 run lint
npx pnpm@10.13.1 run test
npx pnpm@10.13.1 run typecheck
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public" npx pnpm@10.13.1 run build
```

最近一次测试结果：

- Test Files：`14 passed`
- Tests：`42 passed`
- Build：通过，包含 `/api/health`、`/b-agent`、`/projects/[id]/export`、`/packages/[id]/export`、`/recaps/export`

## 仍需人工完成

- 安装并启动 Docker Desktop，或提供可用 PostgreSQL。
- 复制 `.env.example` 为 `.env` 并填写本地数据库配置。
- 本地执行 migration 和 seed 后进行页面验收。
- 如需真实 GPT、图片模型或飞书，需要后续提供对应平台授权和密钥配置方式。

## 下一步建议

- 在数据库可用后做一次真实浏览器验收：Workspace 隔离、中文指令、素材上传审核、模板任务、项目快照导出、素材包 ZIP 导出、提醒和复盘。
- 验收通过后再决定是否合并 main 和创建稳定 Tag。
