# CIRISPortal - Next.js Application Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
# Using npm install instead of npm ci due to npm version differences
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_REGISTRY_API_URL=/api/registry

# Build-time only: dummy values so Next.js static page collection
# doesn't fail on auth route validation. Real values injected at runtime.
ENV APP_ENV=build
ENV NEXTAUTH_SECRET=build-time-placeholder-not-used-at-runtime

# Build the application
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy proto files for gRPC
COPY --from=builder /app/lib/grpc/*.proto ./lib/grpc/

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
