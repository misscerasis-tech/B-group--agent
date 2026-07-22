import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const cwd = process.cwd();
const packagePath = path.join(cwd, "package.json");
const envPath = path.join(cwd, ".env");

function run(command, args = []) {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      output:
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "unknown error",
    };
  }
}

function statusLine(ok, label, detail) {
  const mark = ok ? "OK" : "WARN";
  console.log(`[${mark}] ${label}${detail ? `：${detail}` : ""}`);
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

console.log("B 组 AI 内容增长 Agent 本地诊断");
console.log(`目录：${cwd}`);

if (!existsSync(packagePath)) {
  statusLine(false, "项目目录", "当前目录没有 package.json，请先 cd 到 ai-content-growth-agent");
  process.exit(0);
}

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
statusLine(
  packageJson.name === "ai-content-growth-agent",
  "项目目录",
  `package: ${packageJson.name ?? "unknown"}`,
);

const branch = run("git", ["branch", "--show-current"]);
statusLine(branch.ok, "Git 分支", branch.ok ? branch.output : "无法读取");

const gitStatus = run("git", ["status", "--short"]);
statusLine(
  gitStatus.ok && !gitStatus.output,
  "Git 状态",
  gitStatus.output ? "存在未提交或未跟踪文件，请提交前仔细区分 A/B/C 组" : "干净",
);

const nodeVersion = run("node", ["--version"]);
statusLine(nodeVersion.ok, "Node.js", nodeVersion.ok ? nodeVersion.output : "未检测到");

const pnpmVersion = run("npx", ["pnpm@10.13.1", "--version"]);
statusLine(
  pnpmVersion.ok,
  "pnpm",
  pnpmVersion.ok ? pnpmVersion.output : "可用 npx pnpm@10.13.1 安装",
);

const dockerVersion = run("docker", ["--version"]);
statusLine(
  dockerVersion.ok,
  "Docker",
  dockerVersion.ok ? dockerVersion.output : "未检测到，需要安装 Docker Desktop 或提供 PostgreSQL",
);

const composeVersion = run("docker", ["compose", "version"]);
statusLine(composeVersion.ok, "Docker Compose", composeVersion.ok ? composeVersion.output : "未检测到");

if (!existsSync(envPath)) {
  statusLine(false, ".env", "不存在，请复制 .env.example 为 .env 并填写 DATABASE_URL");
} else {
  const env = readFileSync(envPath, "utf8");
  statusLine(
    env.includes("DATABASE_URL="),
    ".env",
    env.includes("DATABASE_URL=") ? "已找到 DATABASE_URL" : "缺少 DATABASE_URL",
  );
}

const port3002Open = await isPortOpen(3002);
statusLine(!port3002Open, "端口 3002", port3002Open ? "已被占用，可改用 3003" : "当前空闲");

console.log("");
console.log("常用启动命令：");
console.log("1. npx pnpm@10.13.1 install");
console.log("2. cp .env.example .env");
console.log("3. npx pnpm@10.13.1 run docker:up");
console.log("4. npx pnpm@10.13.1 run db:migrate");
console.log("5. npx pnpm@10.13.1 run db:seed");
console.log("6. npx pnpm@10.13.1 run dev:b");
console.log("");
console.log("如果 3002 被占用：npx pnpm@10.13.1 exec next dev -p 3003");
