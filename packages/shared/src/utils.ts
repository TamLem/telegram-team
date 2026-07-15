export function generateId(): string {
  return crypto.randomUUID();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

/** Human label for chore recurrence (presets + custom every-N-days). */
export function formatChoreInterval(
  interval: string,
  intervalDays?: number | null
): string {
  switch (interval) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "custom": {
      const n = intervalDays ?? 1;
      return n === 1 ? "Every day" : `Every ${n} days`;
    }
    default:
      return interval;
  }
}

/** Label for when the assignee is notified each chore cycle. */
export function formatRemindOffset(minutes: number): string {
  if (!minutes || minutes <= 0) return "Notify when due";
  if (minutes === 15) return "Notify 15 min before each due";
  if (minutes === 60) return "Notify 1h before each due";
  if (minutes === 180) return "Notify 3h before each due";
  if (minutes === 1440) return "Notify 1 day before each due";
  if (minutes === 10080) return "Notify 1 week before each due";
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return d === 1
      ? "Notify 1 day before each due"
      : `Notify ${d} days before each due`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1
      ? "Notify 1h before each due"
      : `Notify ${h}h before each due`;
  }
  return `Notify ${minutes} min before each due`;
}
