export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorDetails(error: unknown, depth = 0): string {
  const indent = "  ".repeat(depth);
  if (!(error instanceof Error)) {
    return `${indent}${String(error)}`;
  }

  const lines = [`${indent}${error.stack ?? `${error.name}: ${error.message}`}`];
  const details = (error as Error & { details?: unknown }).details;
  if (details !== undefined) {
    lines.push(`${indent}details: ${JSON.stringify(details)}`);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    lines.push(`${indent}caused by:`);
    lines.push(errorDetails(cause, depth + 1));
  }

  return lines.join("\n");
}

export function logError(label: string, error: unknown, context?: Record<string, unknown>): void {
  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  console.error(`${label}${suffix}\n${errorDetails(error)}`);
}
