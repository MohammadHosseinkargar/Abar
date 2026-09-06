FROM node:22-slim AS base

FROM base AS build
WORKDIR /usr/src/app
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_GA_MEASUREMENT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

FROM base
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/.output ./.output
COPY --from=build /usr/src/app/package.json ./package.json
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD [ "node", ".output/server/index.mjs" ]
