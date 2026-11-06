FROM python:3.12-slim

# Install system dependencies including curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user and group
RUN groupadd -g 1000 ctf && \
    useradd -u 1000 -g ctf -m -s /bin/bash ctf

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source and challenges registry
COPY challenges.json .
COPY src/ ./src/

# Prepare writable data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R ctf:ctf /app

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/app/data/scoreboard.db \
    CHALLENGES_FILE=/app/challenges.json

# Switch to non-root user
USER ctf

# Expose scoreboard port
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI scoreboard server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
