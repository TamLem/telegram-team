import type { FC } from "hono/jsx";
import { REMIND_OFFSET_OPTIONS } from "@telegram-team/shared";

/**
 * Schedule fields for *recurring* chores only — always repeats, no one-shot
 * “does not repeat” path. Order: how often → next due → notify each cycle.
 */
export const ChoreReminderFields: FC<{
  interval?: string;
  intervalDays?: number | null;
  nextDueLocal?: string;
  notifyEnabled?: boolean;
  remindOffsetMinutes?: number;
  /** Element id prefix to avoid collisions (new vs edit). */
  idPrefix?: string;
}> = ({
  interval = "weekly",
  intervalDays,
  nextDueLocal,
  notifyEnabled = true,
  remindOffsetMinutes = 0,
  idPrefix = "chore",
}) => {
  const showCustom = interval === "custom";
  const intervalId = `${idPrefix}-interval`;
  const customId = `${idPrefix}-custom-days-group`;

  return (
    <>
      <div
        class="card"
        style="border-left: 3px solid #0d9488; margin-bottom: 12px; padding: 12px;"
      >
        <div class="form-label" style="margin-bottom: 4px;">
          Recurring schedule
        </div>
        <p class="card-subtitle" style="margin-bottom: 12px;">
          Chores always repeat. After someone marks done, the next due is set
          automatically from this cadence.
        </p>

        <div class="form-group">
          <label class="form-label" for={intervalId}>
            How often *
          </label>
          <select
            id={intervalId}
            name="interval"
            class="form-select"
            required
            onchange={`var el=document.getElementById('${customId}');if(el)el.style.display=this.value==='custom'?'block':'none';`}
          >
            <option value="daily" selected={interval === "daily"}>
              Every day
            </option>
            <option value="weekly" selected={interval === "weekly"}>
              Every week
            </option>
            <option value="biweekly" selected={interval === "biweekly"}>
              Every 2 weeks
            </option>
            <option value="monthly" selected={interval === "monthly"}>
              Every month
            </option>
            <option value="custom" selected={interval === "custom"}>
              Every X days…
            </option>
          </select>
        </div>

        <div
          class="form-group"
          id={customId}
          style={showCustom ? "margin-bottom: 0;" : "display:none;"}
        >
          <label class="form-label" for={`${idPrefix}-intervalDays`}>
            Number of days *
          </label>
          <input
            id={`${idPrefix}-intervalDays`}
            name="intervalDays"
            type="number"
            class="form-input"
            min={1}
            max={365}
            step={1}
            value={intervalDays != null ? String(intervalDays) : ""}
            placeholder="e.g. 3 for every 3 days"
          />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for={`${idPrefix}-nextDueAt`}>
          Next due *
        </label>
        <input
          id={`${idPrefix}-nextDueAt`}
          name="nextDueAt"
          type="datetime-local"
          class="form-input"
          required
          value={nextDueLocal ?? ""}
        />
        <p class="card-subtitle" style="margin-top:6px;">
          First (or next) time this chore is due. Completing it rolls this
          forward by the cadence above — not a one-time deadline.
        </p>
      </div>

      <div
        class="card"
        style="border-left: 3px solid #6366f1; margin-bottom: 12px; padding: 12px;"
      >
        <div class="form-label" style="margin-bottom: 4px;">
          Notify each cycle
        </div>
        <p class="card-subtitle" style="margin-bottom: 12px;">
          Optional Telegram ping for the assignee on <strong>every</strong>{" "}
          due cycle (not a single one-time alert).
        </p>
        <div class="form-group" style="margin-bottom: 10px;">
          <label
            class="form-label"
            style="display:flex;align-items:center;gap:8px;font-weight:500;"
          >
            <input
              type="checkbox"
              name="notifyEnabled"
              value="1"
              checked={notifyEnabled}
            />
            Send Telegram on each due cycle
          </label>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for={`${idPrefix}-remindOffset`}>
            Timing (every cycle)
          </label>
          <select
            id={`${idPrefix}-remindOffset`}
            name="remindOffsetMinutes"
            class="form-select"
          >
            {REMIND_OFFSET_OPTIONS.map((opt) => (
              <option
                value={String(opt.value)}
                selected={remindOffsetMinutes === opt.value}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
};

/** Local datetime-local value from ISO (or now). */
export function toDatetimeLocalValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return toDatetimeLocalValue(null);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Convert datetime-local form value to ISO for API. */
export function fromDatetimeLocalValue(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid next due date & time");
  }
  return d.toISOString();
}
