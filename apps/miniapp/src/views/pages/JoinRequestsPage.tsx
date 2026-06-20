import type { FC } from "hono/jsx";
import type { JoinRequestResponse } from "../../services/apiClient.js";
import { MiniAppNav } from "../components/MiniAppNav.js";

export const JoinRequestsPage: FC<{
  teamId: string;
  requests: (JoinRequestResponse & {
    user: { id: string; firstName: string; telegramUsername: string | null };
  })[];
  ctx?: string;
  error?: string;
  success?: string;
}> = ({ teamId, requests, ctx, error, success }) => {
  const ctxQuery = ctx ? `?ctx=${ctx}` : "";

  return (
    <div>
      <MiniAppNav ctx={ctx} teamId={teamId} current="team" />

      <a href={`/app/team${ctxQuery}`} class="back-link">
        &larr; Back to Team
      </a>

      <div class="header">
        <h1>Join Requests</h1>
        {error && (
          <p style="color: var(--tg-theme-destructive-text-color, #dc2626); margin-top: 8px; font-size: 14px;">
            {error}
          </p>
        )}
        {success && (
          <p style="color: #16a34a; margin-top: 8px; font-size: 14px;">
            {success}
          </p>
        )}
      </div>

      {requests.map((req) => (
        <div class="card" key={req.id}>
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="card-title">{req.user.firstName}</div>
              <div class="card-subtitle">
                {req.user.telegramUsername
                  ? `@${req.user.telegramUsername}`
                  : "No username"}
              </div>
              <div class="card-subtitle" style="margin-top: 4px;">
                Requested {new Date(req.requestedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <form method="post" action={`/app/team/join-requests${ctxQuery}`} style="flex: 1;">
              <input type="hidden" name="ctx" value={ctx ?? ""} />
              <input type="hidden" name="requestId" value={req.id} />
              <input type="hidden" name="action" value="approve" />
              <button type="submit" class="btn btn-block" style="font-size: 13px; padding: 8px 14px;">
                Approve
              </button>
            </form>
            <form method="post" action={`/app/team/join-requests${ctxQuery}`} style="flex: 1;">
              <input type="hidden" name="ctx" value={ctx ?? ""} />
              <input type="hidden" name="requestId" value={req.id} />
              <input type="hidden" name="action" value="reject" />
              <button
                type="submit"
                class="btn btn-secondary btn-block"
                style="font-size: 13px; padding: 8px 14px;"
                onclick="return confirm('Reject this request?')"
              >
                Reject
              </button>
            </form>
          </div>
        </div>
      ))}

      {requests.length === 0 && (
        <div class="empty-state">
          <h2>No pending requests</h2>
          <p>New join requests will appear here.</p>
        </div>
      )}
    </div>
  );
};
