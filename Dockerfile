# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – deps
#   Install production + dev dependencies separately so the cache layer for
#   node_modules is only invalidated when package-lock.json actually changes.
#   BuildKit cache-mount keeps the npm cache on the host between builds, so
#   platform-specific native binaries (rollup, rolldown, lightningcss …) are
#   downloaded only once and reused on every subsequent build.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /usr/src/app

# Copy manifests only – this layer is cached until package-lock.json changes
COPY package.json package-lock.json .npmrc ./

# --mount=type=cache keeps ~/.npm between builds (host-side cache).
# npm_config_prefer_ipv4=true forces IPv4 first, avoiding stalls on servers
# where Docker's IPv6 AAAA resolution hangs.
# --prefer-offline is NOT set so the cache is always validated, but already-
# cached tarballs are served locally without a network round-trip.
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm_config_prefer_ipv4=true \
    npm ci --include=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – build
#   Copy source, inject build-time env vars, run the Vite/Vinxi build.
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

# Bring in installed dependencies from the deps stage
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy the rest of the source tree
COPY . .

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – runtime
#   Minimal image: only the compiled .output artefacts + Node runtime.
#   No source, no node_modules, no build tools.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Copy only what the server needs at runtime
COPY --from=build /usr/src/app/.output ./.output
COPY --from=build /usr/src/app/package.json ./package.json

EXPOSE 3000

# Use tini-compatible exec form so signals propagate correctly and the
# container shuts down cleanly (node:22-slim ships without tini by default,
# but exec-form CMD still forwards SIGTERM to Node directly).
CMD ["node", ".output/server/index.mjs"]
