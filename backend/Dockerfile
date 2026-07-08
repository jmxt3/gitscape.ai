# Dockerfile
# This file describes how to build the Docker image for your FastAPI application.

FROM python:3.10-slim

# Install system dependencies and clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates gcc python3-dev git && \
    rm -rf /var/lib/apt/lists/*

# Install uv via pip — lands in /usr/local/bin, accessible to all users
RUN pip install --no-cache-dir uv

# Create a non-root user for security
RUN useradd -m -u 1001 appuser

WORKDIR /app

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock /app/

# Install Python dependencies (writes venv to /app/.venv)
RUN uv sync --frozen --no-install-project

# Copy the rest of the application code
COPY . .

# Hand ownership of /app to appuser
RUN chown -R appuser:appuser /app

# Expose the port
EXPOSE 8080

# Switch to non-root user
USER appuser

# Use ENTRYPOINT for flexibility — respects Cloud Run's $PORT injection
ENTRYPOINT ["sh", "-c", "uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8081}"]
