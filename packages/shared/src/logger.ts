function ts(): string {
  return new Date().toISOString();
}

function fmtErr(err: unknown): string {
  if (err instanceof Error) {
    let out = `${err.name}: ${err.message}`;
    if (err.stack) {
      const lines = err.stack.split("\n");
      for (let i = 1; i < Math.min(lines.length, 4); i++) {
        out += `\n  ${lines[i].trim()}`;
      }
    }
    if (err.cause) {
      out += `\n  cause: ${fmtErr(err.cause)}`;
    }
    return out;
  }
  return String(err);
}

export function createLogger(tag: string) {
  return {
    debug(msg: string, ctx?: Record<string, unknown>) {
      const extra = ctx ? ` ${JSON.stringify(ctx)}` : "";
      console.debug(`${ts()} [${tag}] DEBUG ${msg}${extra}`);
    },
    info(msg: string, ctx?: Record<string, unknown>) {
      const extra = ctx ? ` ${JSON.stringify(ctx)}` : "";
      console.log(`${ts()} [${tag}] INFO ${msg}${extra}`);
    },
    warn(msg: string, ctx?: Record<string, unknown>) {
      const extra = ctx ? ` ${JSON.stringify(ctx)}` : "";
      console.warn(`${ts()} [${tag}] WARN ${msg}${extra}`);
    },
    error(msg: string, err?: unknown, ctx?: Record<string, unknown>) {
      const extra = ctx ? ` ${JSON.stringify(ctx)}` : "";
      const details = err ? `\n${fmtErr(err)}` : "";
      console.error(`${ts()} [${tag}] ERROR ${msg}${extra}${details}`);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
