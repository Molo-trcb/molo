FROM node:20-slim AS builder

WORKDIR /opt/outline

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install Yarn 4
RUN corepack enable && corepack prepare yarn@4.11.0 --activate

# Install dependencies
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install

# Copy source and build
COPY . .
RUN yarn build

# ---
FROM node:20-slim AS runner

WORKDIR /opt/outline
ENV NODE_ENV=production

RUN addgroup --gid 1001 nodejs && \
    adduser --uid 1001 --ingroup nodejs nodejs && \
    mkdir -p /var/lib/outline/data && \
    chown -R nodejs:nodejs /var/lib/outline && \
    chown -R nodejs:nodejs /opt/outline

COPY --from=builder --chown=nodejs:nodejs /opt/outline/build ./build
COPY --from=builder --chown=nodejs:nodejs /opt/outline/server ./server
COPY --from=builder --chown=nodejs:nodejs /opt/outline/public ./public
COPY --from=builder --chown=nodejs:nodejs /opt/outline/.sequelizerc ./.sequelizerc
COPY --from=builder --chown=nodejs:nodejs /opt/outline/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /opt/outline/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /opt/outline/yarn.lock ./yarn.lock
COPY --from=builder --chown=nodejs:nodejs /opt/outline/.yarnrc.yml ./.yarnrc.yml

ENV FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data
RUN mkdir -p "$FILE_STORAGE_LOCAL_ROOT_DIR" && \
    chown -R nodejs:nodejs "$FILE_STORAGE_LOCAL_ROOT_DIR"

USER nodejs

HEALTHCHECK --interval=1m CMD wget -qO- "http://localhost:${PORT:-3000}/_health" | grep -q "OK" || exit 1

EXPOSE 3000
CMD ["node", "build/server/index.js", "--services=web,websockets,collaboration,worker,cron"]
