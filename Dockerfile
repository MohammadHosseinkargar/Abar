# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – deps
#   npm ci with BuildKit cache-mount so node_modules (including the ~54
#   platform-specific native binaries for rollup/rolldown/lightningcss) are
#   downloaded once and reused on every subsequent build.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /usr/src/app

# Copy manifests only – invalidates only when package-lock.json changes
COPY package.json package-lock.json .npmrc ./

# npm_config_prefer_ipv4=true  → avoid IPv6 stalls inside Docker
# npm_config_fetch_timeout     → per-request hard deadline (90 s)
# npm_config_fetch_retries     → max 3 retries on transient failures
# --mount=type=cache           → keep ~/.npm tarballs between builds
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm_config_prefer_ipv4=true \
    npm_config_fetch_timeout=90000 \
    npm_config_fetch_retries=3 \
    npm_config_fetch_retry_mintimeout=10000 \
    npm_config_fetch_retry_maxtimeout=90000 \
    npm ci --include=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /usr/src/app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_GA_MEASUREMENT_ID

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID \
    NODE_ENV=production

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – runtime  (no node_modules, no source, minimal attack surface)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build /usr/src/app/.output ./.output
COPY --from=build /usr/src/app/package.json ./package.json

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
