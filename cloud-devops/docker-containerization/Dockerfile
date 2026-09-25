# Stage 1: install production dependencies
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY app/package.json ./

RUN npm install --omit=dev


# Stage 2: minimal Alpine production runtime
FROM alpine:3.22

RUN apk add --no-cache nodejs \
    && addgroup -S node \
    && adduser -S node -G node

WORKDIR /app

ENV NODE_ENV=production

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node app/package.json ./
COPY --chown=node:node app/server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
