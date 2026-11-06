FROM python:3.12-slim

# Install system dependencies: iputils-ping, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && (chmod u+s /bin/ping 2>/dev/null || true)

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Ensure flags directory exists and has correct ownership
RUN mkdir -p /app/flags && chown -R appuser:appuser /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY src/ /app/src/
RUN chown -R appuser:appuser /app

USER appuser

ENV PORT=8005 \
    PYTHONUNBUFFERED=1 \
    FLAGS_DIR=/app/flags

EXPOSE 8005

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8005/health || exit 1

WORKDIR /app/src

CMD ["python", "app.py"]
