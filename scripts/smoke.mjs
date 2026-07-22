const DEFAULT_BASE_URL = "http://127.0.0.1:3002";
const DEFAULT_TIMEOUT_MS = 5000;

const args = parseArgs(process.argv.slice(2));
const baseUrl = normalizeBaseUrl(args.url ?? DEFAULT_BASE_URL);
const timeoutMs = Number.parseInt(args.timeout ?? String(DEFAULT_TIMEOUT_MS), 10);
const allowUnhealthyDb = Boolean(args["allow-unhealthy-db"]);

const checks = [
  {
    label: "本地诊断页",
    path: "/setup",
    expectedStatus: 200,
    expectedText: "B 组 AI 内容增长 Agent",
  },
  {
    label: "机器健康检查",
    path: "/api/health",
    expectedStatus: allowUnhealthyDb ? [200, 503] : 200,
    expectedJson: true,
  },
  {
    label: "B 组 Agent 工作台",
    path: "/b-agent",
    expectedStatus: 200,
    expectedText: "B组 Agent 工作台",
  },
  {
    label: "今日工作台",
    path: "/dashboard",
    expectedStatus: 200,
    expectedText: "今日工作台",
  },
];

console.log("B 组 AI 内容增长 Agent 冒烟检查");
console.log(`目标地址：${baseUrl}`);
console.log("");

const results = [];

for (const check of checks) {
  results.push(await runCheck(check));
}

console.log("");
for (const result of results) {
  const mark = result.ok ? "OK" : "FAIL";
  console.log(`[${mark}] ${result.label}：${result.detail}`);
}

const failures = results.filter((result) => !result.ok);

if (failures.length > 0) {
  console.log("");
  console.log("处理建议：");
  console.log("- 确认已在项目目录启动 Web：npx pnpm@10.13.1 run dev:b");
  console.log("- 如果 3002 被占用，改用：npx pnpm@10.13.1 exec next dev -p 3003");
  console.log("- 如果 /api/health 显示数据库不可用，先启动 PostgreSQL 并运行 migration/seed。");
  process.exitCode = 1;
} else {
  console.log("");
  console.log("冒烟检查通过，可以进入页面验收。");
}

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const statusOk = Array.isArray(check.expectedStatus)
      ? check.expectedStatus.includes(response.status)
      : response.status === check.expectedStatus;

    if (!statusOk) {
      return {
        ok: false,
        label: check.label,
        detail: `${check.path} 返回 HTTP ${response.status}`,
      };
    }

    if (check.expectedJson) {
      const json = await response.json();
      const healthOk = Boolean(json.ok);
      const databaseStatus = json.database?.status ?? "unknown";

      if (!healthOk && !allowUnhealthyDb) {
        return {
          ok: false,
          label: check.label,
          detail: `健康检查未通过，database.status=${databaseStatus}`,
        };
      }

      return {
        ok: true,
        label: check.label,
        detail: `service=${json.service ?? "unknown"}，database.status=${databaseStatus}`,
      };
    }

    const text = await response.text();

    if (check.expectedText && !text.includes(check.expectedText)) {
      return {
        ok: false,
        label: check.label,
        detail: `${check.path} 没有包含预期中文文本「${check.expectedText}」`,
      };
    }

    return {
      ok: true,
      label: check.label,
      detail: `${check.path} 返回 HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      label: check.label,
      detail: error instanceof Error ? error.message : "请求失败",
    };
  }
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = rawArgs[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
