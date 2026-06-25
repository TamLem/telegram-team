FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS build-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json tsconfig.base.json ./
COPY packages/config/package.json   packages/config/
COPY packages/shared/package.json   packages/shared/
COPY packages/db/package.json       packages/db/
COPY packages/bot-engine/package.json packages/bot-engine/
COPY apps/api/package.json          apps/api/
COPY apps/bot/package.json          apps/bot/
COPY apps/miniapp/package.json      apps/miniapp/
RUN pnpm install --frozen-lockfile

FROM build-deps AS build
COPY . .
RUN pnpm build

FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json tsconfig.base.json ./
COPY packages/config/package.json   packages/config/
COPY packages/shared/package.json   packages/shared/
COPY packages/db/package.json       packages/db/
COPY packages/bot-engine/package.json packages/bot-engine/
COPY apps/api/package.json          apps/api/
COPY apps/bot/package.json          apps/bot/
COPY apps/miniapp/package.json      apps/miniapp/
RUN pnpm install --frozen-lockfile --prod

FROM node:20-alpine
RUN rm -rf /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=build /app/packages     ./packages
COPY --from=build /app/apps         ./apps
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
RUN find /app/packages /app/apps -not -path '*/node_modules/*' \
    \( -name '*.ts' -not -name '*.d.ts' -o -name '*.map' -o -name '*.d.ts.map' \) \
    -delete 2>/dev/null; \
    mkdir -p /app/data

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- "http://localhost:${API_PORT:-${MINIAPP_PORT:-${BOT_PORT:-${PORT:-3000}}}}/health" || exit 1

CMD ["node", "apps/api/dist/index.js"]
