FROM node:22.20.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs ./
COPY scripts/compiler-job.mjs scripts/compiler-job.mjs
COPY src/lib/compiler-input.js src/lib/compiler-input.js
COPY public/chain.json public/imports.json public/templates.json public/
COPY dist/ dist/
USER node
ENV NODE_ENV=production DATA_DIR=/data PORT=8120
CMD ["node","--max-old-space-size=256","server.mjs"]
