FROM node:20-slim

WORKDIR /app

# Copy shared modules and worker
COPY package.json tsconfig.json ./
COPY src/shared/ ./src/shared/
COPY src/worker/ ./src/worker/

# Install deps (production only)
RUN npm install --omit=dev

# Build TypeScript
RUN npx tsc --outDir dist --rootDir src

# Run worker
CMD ["node", "dist/worker/index.js"]
