import type { FC } from "hono/jsx";

export const OnboardingPage: FC<{ ctx?: string }> = () => {
  return (
    <div>
      <div class="header">
        <h1>Welcome to TaskPi</h1>
      </div>

      <p style="margin-bottom: 24px; color: var(--tg-theme-hint-color, #64748b); font-size: 15px;">
        To start, create a team or join an existing team.
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
        <a href="/app/onboarding/create-team" class="btn btn-block">
          Create Team
        </a>
        <a href="/app/onboarding/join-team" class="btn btn-block btn-secondary">
          Join Team
        </a>
      </div>
    </div>
  );
};
