import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "@telegram-team/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

loadRootEnv();

function getPort(key: string, fallback: string): string {
  const val = process.env[key];
  if (!val || val.trim() === "") return fallback;
  return val;
}

const apiPort = getPort("API_PORT", getPort("PORT", "3001"));
const miniappPort = getPort("MINIAPP_PORT", getPort("PORT", "3002"));
const botPort = getPort("BOT_PORT", getPort("PORT", "3000"));

const env = { ...process.env };

const tsxBin = path.join(
  root,
  "node_modules",
  ".pnpm",
  "node_modules",
  ".bin",
  "tsx"
);

function run(label: string, args: string[], extraEnv?: Record<string, string>): ChildProcess {
  const child = spawn(tsxBin, args, {
    cwd: root,
    env: { ...env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (data: Buffer) => {
    for (const line of data.toString().trim().split("\n")) {
      console.log(`[${label}] ${line}`);
    }
  });

  child.stderr.on("data", (data: Buffer) => {
    for (const line of data.toString().trim().split("\n")) {
      console.error(`[${label}] ${line}`);
    }
  });

  child.on("exit", (code) => {
    console.log(`[${label}] exited with code ${code}`);
  });

  return child;
}

function shutdown(children: ChildProcess[]) {
  console.log("\nShutting down...");
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    process.exit(0);
  }, 3000);
}

async function main() {
  const noTunnel = process.argv.includes("--no-tunnel");
  const children: ChildProcess[] = [];

  process.on("SIGINT", () => shutdown(children));
  process.on("SIGTERM", () => shutdown(children));

  console.log("=== Starting local development ===\n");

  // 1. Start API
  console.log(`[api] starting on port ${apiPort}...`);
  children.push(
    run("api", ["apps/api/src/index.ts"], {
      PORT: apiPort,
    })
  );
  await sleep(2000);

  // 2. Start Mini App
  console.log(`[miniapp] starting on port ${miniappPort}...`);
  children.push(
    run("miniapp", ["apps/miniapp/dist/index.js"], {
      PORT: miniappPort,
    })
  );
  await sleep(2000);

  let tunnelUrl: string | null = null;

  // 3. Start Cloudflare Tunnel (unless --no-tunnel)
  if (!noTunnel) {
    console.log("[tunnel] starting cloudflared...");
    try {
      tunnelUrl = await startCloudflareTunnel(miniappPort, children);
      console.log(`[tunnel] PUBLIC URL: ${tunnelUrl}\n`);
    } catch (err) {
      console.error(`[tunnel] failed: ${err instanceof Error ? err.message : err}`);
      console.log("[tunnel] continuing without tunnel — set MINIAPP_BASE_URL manually\n");
    }
  } else {
    console.log("[tunnel] skipped (--no-tunnel)\n");
  }

  const miniAppBaseUrl =
    tunnelUrl ??
    (env.MINIAPP_BASE_URL?.trim() || undefined) ??
    `http://localhost:${miniappPort}`;

  // 4. Start Bot
  const botMode = env.BOT_UPDATE_MODE ?? "polling";
  console.log(`[bot] starting in ${botMode} mode...`);
  children.push(
    run("bot", ["apps/bot/src/index.ts"], {
      MINIAPP_BASE_URL: miniAppBaseUrl,
      BOT_UPDATE_MODE: botMode,
      PORT: botPort,
    })
  );

  console.log("\n=== All services running ===\n");
  console.log(`  API:      http://localhost:${apiPort}`);
  console.log(`  Mini App: ${miniAppBaseUrl}`);
  console.log(`  Bot:      ${botMode} mode\n`);
}

function startCloudflareTunnel(
  port: string,
  children: ChildProcess[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    children.push(tunnel);

    let resolved = false;

    tunnel.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-z0-9]+-[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        resolve(match[0]);
      }
      process.stderr.write(`[tunnel] ${text}`);
    });

    tunnel.on("exit", (code) => {
      if (!resolved) {
        reject(new Error(`cloudflared exited with code ${code}`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        reject(new Error("cloudflared: timed out waiting for tunnel URL"));
      }
    }, 30_000);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("dev failed:", err);
  process.exit(1);
});
