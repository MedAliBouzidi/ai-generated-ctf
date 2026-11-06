FROM python:3.12-slim

# Install system dependencies (curl needed for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root application user
RUN useradd -m -u 1000 -s /bin/bash appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=120 --retries=5 -r requirements.txt

# Pre-create root traversal flag target and set ownership
RUN touch /flag_traversal.txt && chown appuser:appuser /flag_traversal.txt && \
    mkdir -p /app/plugins && ln -s /app/plugins /plugins

# Copy application source
COPY src/ /app/

# Set ownership of /app to appuser
RUN mkdir -p /app/uploads /app/flags /app/plugins && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8003

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8003"]
