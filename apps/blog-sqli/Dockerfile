FROM python:3.12-slim

# Install system dependencies including curl for healthchecks
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root CTF application user
RUN useradd -m -u 1000 ctfuser

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and challenge metadata
COPY src/ /app/src/
COPY challenges.json /app/
COPY README.md /app/
COPY WALKTHROUGH.md /app/

# Ensure ctfuser owns application directory and writable database path
RUN chown -R ctfuser:ctfuser /app && \
    mkdir -p /tmp/blog && \
    chown -R ctfuser:ctfuser /tmp/blog

USER ctfuser

ENV PORT=8001 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/tmp/blog/blog.db

EXPOSE 8001

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "src/app.py"]
