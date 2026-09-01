# Next.js buyer app + merchant portal, built with `output: "standalone"`
# (next.config.ts) so the final image ships only the pruned node_modules
# subset the build actually needs, not the full dependency tree.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at runtime — this must be passed as a build ARG (docker build
# --build-arg, or render.yaml's envVars on a docker-runtime service, which
# Render forwards as build args for you).
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
# Render (and most PaaS hosts) inject the port to bind via $PORT; 3000 is
# the local-dev fallback (see docker-compose.yml). The standalone server
# only binds 127.0.0.1 unless HOSTNAME is set explicitly.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 PORT=${PORT:-3000} node server.js"]
