# KPL Gallery Server — standalone image for Coolify
FROM node:20-bookworm-slim

WORKDIR /app

# sharp 0.33 ships prebuilt binaries; no native build toolchain needed.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY gallery-server.js ./

ENV PORT=4000
EXPOSE 4000

# MEDIA_ROOT is a bind-mounted KPL-only host directory (see DEPLOY.md).
CMD ["node", "gallery-server.js"]
