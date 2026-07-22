# B 组工作助手验收清单

本清单用于验收 `feature/b-group-working-assistant`。当前目标不是静态演示页，而是本地可运行、可保存、可回滚的 AI 内容增长工作助手底座。

## 启动前

- 已安装 Node.js、pnpm 或可使用 `npx pnpm@10.13.1`。
- 已安装并启动 Docker Desktop。
- 已复制 `.env.example` 为 `.env`，并填写本地 PostgreSQL 用户名、密码和 `DATABASE_URL`。
- 已执行数据库迁移和 seed。

## 推荐命令

```bash
npx pnpm@10.13.1 install
npx pnpm@10.13.1 run docker:up
npx pnpm@10.13.1 run db:migrate
npx pnpm@10.13.1 run db:seed
npx pnpm@10.13.1 exec next dev -p 3002
```

打开：

```text
http://127.0.0.1:3002/b-agent
```

## 必验流程

- 顶部可以在 `演示增长团队` 与 `欧洲增长演示团队` 之间切换，项目和产品数据不会串到另一个 Workspace。
- 顶部可以创建新的 Workspace，创建后自动切换，新 Workspace 初始为空数据。
- `/b-agent` 可以看到左侧中文对话和右侧结构化工作台。
- 在 `/b-agent` 输入：`巴西不做 LinkedIn，新增 TikTok，下个月每周生成一次素材包。`
- 策略未确认时，明确指令可直接写入策略和变更日志。
- 在 `/b-agent` 输入：`不要学生用户，新增礼品购买者，本月不做小抽奖。` 可以识别客群和内容方向调整。
- 在 `/b-agent` 输入：`暂停这个项目，新增 TikTok。` 可以识别项目状态变更并写入 Project 表。
- 在 `/b-agent` 输入：`提醒我提前确认巴西抽奖奖品和活动规则。` 可以创建当前项目提醒。
- 确认正式策略后，再提交策略修改会进入待确认队列；可以确认应用或拒绝。确认后创建新的策略版本，拒绝后正式策略保持不变。
- 产品大脑可以从产品说明或补充资料提取事实；已确认事实不会被静默覆盖。
- 素材库上传素材时，只能关联当前 Workspace 下的项目和产品；上传后自动出现在审核中心，素材可审核通过或拒绝，且素材库直接处理会同步关闭对应审核任务。
- 内容日历可以把计划项设为可执行、需审核或已完成。
- 素材包中心可以推进文件项状态，并下载本地 ZIP 清单。
- 项目详情和 `/b-agent` 可以下载项目工作台 JSON 快照，且快照只包含当前 Workspace 下的数据。
- 审核中心可以生成审核任务，并将通过/要求修改写回业务对象；误生成任务可以取消。
- 提醒中心可以生成主动提醒，并标记完成或忽略。
- 提醒中心可以手动创建 Workspace 或项目级提醒，并在卡片上显示级别和截止日期。
- 数据复盘可以手动录入曝光、点击、转化和花费，并在页面聚合展示。
- 集成设置可以保存飞书占位连接、停用旧连接、记录迁移说明；不需要真实飞书授权。

## 技术验收

```bash
npx pnpm@10.13.1 exec prisma validate
npx pnpm@10.13.1 run lint
npx pnpm@10.13.1 run typecheck
npx pnpm@10.13.1 run test
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public" npx pnpm@10.13.1 run build
```

## 不在本阶段验收

- 真实 GPT 调用。
- 真实飞书 API 连接。
- 真实社媒平台数据 API。
- 正式 PDF、DOCX、XLSX、PNG 成品生成。
- AI 重绘产品图或生成产品主体。
