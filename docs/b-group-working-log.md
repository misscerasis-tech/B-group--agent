# B 组工作助手开发日志

## 当前分支

- `feature/b-group-working-assistant`
- 远程仓库：`misscerasis-tech/B-group--agent.git`
- 当前最新提交：以 `git log -1 --oneline` 为准；本分支正在持续推进，不合并 `main`，不创建 tag。

## 当前环境提示

- 本机 Node.js 与 pnpm 可用。
- 当前机器未检测到 `docker` 命令；本地 PostgreSQL 仍需要用户安装并启动 Docker Desktop，或提供可用的外部 PostgreSQL `DATABASE_URL`。
- 当前 3002 端口曾被其他进程占用；B 组推荐使用 `npx pnpm@10.13.1 run dev:b`，若端口冲突则改用 `npx pnpm@10.13.1 exec next dev -p 3003`。
- `/setup` 可用于查看中文本地运行诊断，`/api/health` 可用于确认 Web 进程、环境变量和数据库连接状态。
- `npx pnpm@10.13.1 run doctor` 可检查当前目录、Git 分支、Node、pnpm、Docker、`.env` 和 3002 端口占用。
- `npx pnpm@10.13.1 run smoke` 可在 Web 启动后检查 `/setup`、`/api/health`、`/b-agent` 和 `/dashboard`；如果改用 3003，追加 `-- --url http://127.0.0.1:3003`。
- Prisma seed 配置已迁移到 `prisma.config.ts`，避免继续依赖已弃用的 `package.json#prisma`。

## 已推送能力概览

- 数据库驱动的 `/b-agent` 工作台：中文对话 + 结构化项目工作台。
- Workspace 创建、切换和多 Workspace 数据隔离。
- 项目、产品、产品事实、策略、计划、素材包、审核、提醒、复盘和集成占位数据模型。
- Agent 中文可执行能力目录集中维护标题、示例、写入表和人工审核要求，`/b-agent` 页面从该目录渲染指令提示。
- `AgentTextProvider` 文本 Agent 抽象；当前 `local-rule` 支持市场、渠道、客群、内容方向、素材包频率、项目状态、产品事实新增、提醒创建、提醒完成、计划完成、指定周期素材包创建、素材包提交审核和素材包审核决策。
- B 组 Agent 支持从对话中粘贴的中文产品资料批量提取产品事实，并写入当前项目关联产品；新事实进入需复核状态，已确认事实不会被静默覆盖。
- B 组 Agent 支持用中文录入渠道表现指标，并写入数据复盘和变更日志。
- B 组 Agent 支持用中文新增内容日历计划项，并写入变更日志。
- B 组 Agent 支持用中文完成项目提醒和内容日历计划项；如果当前项目内找不到匹配的开放提醒或未完成计划，会失败并避免误写入。
- B 组 Agent 支持用中文创建指定周期素材包结构，并自动补齐 V1 默认 11 项文件清单。
- B 组 Agent 支持用中文提交素材包审核，自动更新素材包状态、补齐审核任务并写入变更日志。
- B 组 Agent 支持用中文处理素材包审核通过或要求修改，只会匹配当前项目下已有待审核任务。
- Agent 会对正式策略变更输出风险提示，覆盖渠道清空、删除计划仍使用的渠道、内容方向为空、频率降低和项目暂停/归档。
- 正式策略二次确认、拒绝变更和策略版本历史。
- 项目/产品手工操作、Agent 操作、素材、提醒、集成和指标录入的变更日志。
- B 组 Agent 支持把中文新增的产品事实写入当前项目关联产品，状态为需复核，避免绕过产品大脑确认。
- 产品大脑支持从已关联的文本型产品资料 Asset 提取待确认事实。
- 素材库上传校验、自动审核任务、素材状态同步和模板化合成任务记录。
- 素材包 ZIP 可交付文件包导出、项目工作台 JSON 快照导出和 Workspace 复盘 JSON 快照导出。
- 今日工作台支持导出 Workspace 安全备份 JSON，覆盖当前 Workspace 业务数据并屏蔽疑似密钥字段。
- 今日工作台会基于素材包、近期内容计划、开放提醒和渠道表现生成 Agent 工作简报，帮助用户先看重点进展、风险和下一步动作。
- 素材包中心显示可交付性检查，ZIP 内包含 `00-交付检查.txt`，生成图不会被当作真实产品图来源。
- 内容日历状态推进、首月计划截止日期。
- 提醒中心主动提醒、手动提醒、完成/忽略。
- 主动提醒扫描会基于近期渠道表现发现低点击率、无转化和投放花费风险。
- 今日工作台按待确认变更、审核、素材、策略、素材包和近期计划生成行动队列。
- 今日工作台和项目详情会计算项目就绪度，给出缺口摘要和下一步动作。
- 项目详情支持把体检缺口一键生成项目提醒，且不会重复创建同标题开放提醒。
- `/setup` 中文诊断页和增强版 `/api/health` 会提示数据库、环境变量和 AI Provider 降级状态。
- `smoke` 脚本会检查 B 组关键页面和健康接口，帮助演示前快速发现端口、数据库或路由问题。
- 数据复盘单条/批量指标录入、CTR、点击转化率、单次转化成本和可下载复盘快照。
- 飞书占位连接、占位测试、停用旧连接和迁移记录。
- 图片生成产品主体锁定护栏测试。
- 素材包中心支持手动创建 11 项素材包结构、提交 Web 审核、审核任务联动和 ZIP 可交付文件包导出。
- 项目中心支持中文 Brief 启动项目，一次创建项目、产品、关联、待确认事实、策略草案、对话和变更日志。
- Seed 主 Workspace 包含巴西完整项目和蒙古缺口项目，用于演示就绪度、缺口提醒和素材包阻塞。

## 最近完整验证

每个功能提交前均运行过：

```bash
npx pnpm@10.13.1 run lint
npx pnpm@10.13.1 run test
npx pnpm@10.13.1 run typecheck
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public" npx pnpm@10.13.1 run build
```

最近一次测试结果：

- Test Files：`25 passed`
- Tests：`88 passed`
- Build：通过，包含 `/setup`、`/api/health`、`/b-agent`、`/workspace/export`、`/projects/[id]/export`、`/packages/[id]/export`、`/recaps/export`

## 仍需人工完成

- 安装并启动 Docker Desktop，或提供可用 PostgreSQL。
- 复制 `.env.example` 为 `.env` 并填写本地数据库配置。
- 本地执行 migration 和 seed 后进行页面验收。
- 如需真实 GPT、图片模型或飞书，需要后续提供对应平台授权和密钥配置方式。

## 下一步建议

- 在数据库可用后做一次真实浏览器验收：Workspace 隔离、中文指令、素材上传审核、模板任务、项目快照导出、素材包 ZIP 导出、提醒和复盘。
- 验收通过后再决定是否合并 main 和创建稳定 Tag。
