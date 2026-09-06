FROM node:22-slim AS base

FROM base AS build
WORKDIR /usr/src/app
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_GA_MEASUREMENT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
# Copy pre-built output directly — npm install and vite build run on the
# developer's machine (or CI) where network access to npm is fast.
# On the server we just package the already-built artefacts.
COPY .output ./.output
COPY package.json ./

FROM base
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/.output ./.output
COPY --from=build /usr/src/app/package.json ./package.json
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD [ "node", ".output/server/index.mjs" ]
