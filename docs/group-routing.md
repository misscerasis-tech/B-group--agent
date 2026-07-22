# ABC 三组 Agent 路由规则

本项目服务于 AI 赛，A、B、C 三组需要分别交付一个 Agent。为避免页面互相覆盖，禁止再把某一组 Agent 固定占用通用 `/agent`。

## 固定入口

- `/agent`：只作为 A/B/C 分组选择入口，不属于任何单一小组。
- `/a-agent`：A 组 Agent 独立入口。
- `/b-agent`：B 组 Agent 独立入口。
- `/c-agent`：C 组 Agent 独立入口。

## 当前仓库状态

当前仓库和当前分支以 B 组为主：

- B 组：AI 内容增长 Agent。
- 当前可用入口：`/b-agent`。
- B 组后台工作台：`/dashboard`、`/projects`、`/brain` 等。

A 组页面不得覆盖 B 组入口。若 A 组代码和 B 组代码暂时共用一个仓库，也必须放到 `/a-agent` 或独立分支、独立目录、独立端口中。

## 本地端口建议

如果多个 Agent 同时运行：

- A 组：`http://localhost:3001/a-agent`
- B 组：`http://localhost:3002/b-agent`
- C 组：`http://localhost:3003/c-agent`

也可以使用其他空闲端口，但路径必须保持组别清晰。

## 开发规则

- 不允许把某一组页面放到 `/agent` 并长期占用。
- 不允许在 B 组分支中直接覆盖 A 组正常功能。
- 不允许在 A 组分支中覆盖 B 组正常功能。
- 新增组别页面时，必须同步更新本文件。

