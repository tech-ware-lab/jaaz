# Multi-stage Dockerfile for Jaaz AI Design Agent
FROM node:20-alpine AS frontend-builder

# Set working directory for frontend
WORKDIR /app/react

# Copy frontend package files
COPY react/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source code
COPY react/ ./

# Build frontend
RUN npm run build

# Python backend stage
FROM python:3.11-slim AS backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Python requirements and install dependencies
COPY server/requirements.txt ./server/
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy server source code
COPY server/ ./server/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/react/dist ./react/dist/

# Create non-root user
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONPATH=/app/server
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the FastAPI server
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]