FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install curl/wget if needed (wget is built-in in alpine busybox)
# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source
COPY . .

# Set ownership to node user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose service port
EXPOSE 8004

# Define environment variables
ENV NODE_ENV=production
ENV PORT=8004
ENV DIFFICULTY=easy

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8004/health || exit 1

# Start server
CMD ["node", "src/server.js"]
