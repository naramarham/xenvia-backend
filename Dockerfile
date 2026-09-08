# Node 20 has prebuilt binaries available for better-sqlite3 on virtually
# every common deploy target, so a plain slim image is enough — no need to
# install build-essential/python3 unless your host is an unusual arch.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# Persisted across restarts via a mounted volume at /app/data — see
# DEPLOY.md for how to set that up on your chosen platform.
ENV DB_PATH=/app/data/xenvia.sqlite
RUN mkdir -p /app/data

ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/server.js"]
