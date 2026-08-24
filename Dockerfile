# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies ----
FROM base AS deps
# libc6-compat es requerido por Next.js en Alpine (https://github.com/nodejs/docker/issues/550)
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Builder ----
FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* se inyecta en build time. Si no se define aquí, Next usará
# el fallback de lib/api.js (localhost). En Hostinger define NEXT_PUBLIC_API_URL
# como variable de entorno del contenedor; para que se aplique en build,
# pásala como --build-arg (ver README de despliegue).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runner (producción) ----
FROM base AS runner
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Solo lo necesario para `npm run start`
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# Hostinger y el requisito del proyecto exigen `npm run start` (usa `next start`
# que respeta PORT y HOSTNAME)
CMD ["npm", "run", "start"]
