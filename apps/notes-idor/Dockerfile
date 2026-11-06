# VulnLab CTF - notes-idor Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set non-root ownership on working directory
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Copy package descriptors for layer caching
COPY --chown=node:node package*.json ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY --chown=node:node . .

# Expose service port
EXPOSE 8002

# Set production environment defaults
ENV PORT=8002 \
    NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8002/health || exit 1

# Start service
CMD ["node", "src/index.js"]
