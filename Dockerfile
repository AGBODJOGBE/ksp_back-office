# Image du site KSP Back-office (admin.ksp.bj).
# Les variables NEXT_PUBLIC_* sont figées dans le code au moment du build : une image par environnement.
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://admin.ksp.bj --build-arg NEXT_PUBLIC_API_URL=https://api.ksp.bj -t ksp/backoffice .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS build
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PORTAIL_URL
ARG NEXT_PUBLIC_SHOP_URL
ARG NEXT_PUBLIC_PRINT_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
