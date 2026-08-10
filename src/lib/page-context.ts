import net from "node:net";
import { getWorkspaceContext } from "@/lib/workspace-context";

export async function loadWorkspaceContextSafe() {
  try {
    const databaseCheck = await checkDatabaseReachable();

    if (!databaseCheck.ok) {
      return {
        context: null,
        error: databaseCheck.error,
      };
    }

    return {
      context: await getWorkspaceContext(),
      error: null,
    };
  } catch (error) {
    return {
      context: null,
      error: error instanceof Error ? error.message : "无法加载当前 Workspace。",
    };
  }
}

function checkDatabaseReachable() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return Promise.resolve({
      ok: false,
      error: "DATABASE_URL 未配置，当前使用离线演示模式。",
    });
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    return Promise.resolve({
      ok: false,
      error: "DATABASE_URL 格式无效，当前使用离线演示模式。",
    });
  }

  const port = Number(parsedUrl.port || "5432");

  if (!parsedUrl.hostname || Number.isNaN(port)) {
    return Promise.resolve({
      ok: false,
      error: "DATABASE_URL 缺少有效主机或端口，当前使用离线演示模式。",
    });
  }

  return new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
    const socket = net.createConnection({
      host: parsedUrl.hostname,
      port,
    });
    let settled = false;

    function finish(result: { ok: true } | { ok: false; error: string }) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(450);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("timeout", () =>
      finish({
        ok: false,
        error: `数据库连接超时：${parsedUrl.hostname}:${port}，当前使用离线演示模式。`,
      }),
    );
    socket.once("error", () =>
      finish({
        ok: false,
        error: `数据库未连接：${parsedUrl.hostname}:${port}，当前使用离线演示模式。`,
      }),
    );
  });
}
