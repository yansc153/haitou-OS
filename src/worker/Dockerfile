# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/shared/ ./src/shared/
COPY src/worker/ ./src/worker/

RUN npx tsc -p src/worker/tsconfig.json

# Stage 2: Production with Chromium
FROM node:20-slim

# Install Chromium system dependencies + CJK fonts + Python (for markitdown)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && pip3 install --break-system-packages 'markitdown[pdf,docx]' \
    && rm -rf /root/.cache/pip

# Chromium deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libxshmfence1 libx11-xcb1 libxfixes3 libxext6 libx11-6 \
    libxcb1 libxkbcommon0 libatspi2.0-0 libcups2 libdbus-1-3 \
    libexpat1 libgcc-s1 libglib2.0-0 libnspr4 libstdc++6 \
    libuuid1 libxcb-shm0 libxcb-render0 fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only the worker's runtime deps (playwright, anthropic, supabase-js)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Playwright Chromium browser binary
RUN npx playwright install chromium

# Copy compiled worker
COPY --from=builder /app/dist/ ./dist/

EXPOSE 8080

CMD ["node", "dist/worker/index.js"]
