# Local-development image for the FairShare backend.
#
# This is deliberately NOT a production/deployment build (no multi-stage
# slimming, no non-root user, no distroless base) -- it's built to support
# local development via `docker compose up` (see ../docker-compose.yml).
# A real deployment image is future scope.
FROM node:20-alpine

# Prisma's engine binaries are compiled against OpenSSL and need its shared
# libraries (libssl) at runtime. node:20-alpine doesn't include them by
# default -- without this, `prisma generate`/`migrate deploy` fail with a
# cryptic "Could not parse schema engine response" error, because what's
# actually happening is the engine binary itself failing to start.
RUN apk add --no-cache openssl

WORKDIR /app

# Copied separately from the rest of the source so `npm install` is only
# re-run (and its layer re-cached) when package.json/package-lock.json
# actually change, not on every source edit.
COPY package*.json ./
RUN npm install

COPY . .

# `prisma generate` (part of the `build` script below) reads schema.prisma,
# which references DATABASE_URL/DIRECT_URL via env() -- it needs those
# variables to *exist* at build time, even though it never actually
# connects to a database. These placeholders are only used during the
# image build; docker-compose.yml's `environment:` block overrides them
# with the real values when the container actually runs.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build"

# `npm run build` = `prisma generate && tsc` (see package.json) — produces
# both the generated Prisma Client and the compiled dist/ the CMD below runs.
RUN npm run build

EXPOSE 5000

# On every container start: apply any pending Prisma migrations to
# whatever DATABASE_URL actually points at (the `db` service in
# docker-compose.yml), then start the compiled server. `migrate deploy`
# (not `migrate dev`) is used deliberately -- it's non-interactive and
# only applies existing migrations from prisma/migrations/, it never tries
# to generate a new one, which is the correct behavior for an
# already-authored migration history running against a fresh container.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
