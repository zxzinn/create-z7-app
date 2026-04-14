#!/usr/bin/env bash
# Use this script to start docker containers for local development infrastructure
# Supports both Docker and Podman

# TO RUN ON WINDOWS:
# 1. Install WSL - https://learn.microsoft.com/en-us/windows/wsl/install
# 2. Install Docker Desktop or Podman Desktop
# 3. Open WSL - `wsl`
# 4. Run this script - `./start-docker.sh`

set -a
source .env 2>/dev/null || true

# Defaults (match .env.example)
DB_PORT=${DB_PORT:-5432}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-{{projectName}}}
REDIS_PORT=${REDIS_PORT:-6379}
RABBITMQ_PORT=${RABBITMQ_PORT:-5672}
RABBITMQ_MGMT_PORT=${RABBITMQ_MGMT_PORT:-15672}
S3_PORT=${S3_PORT:-8333}

# Parse DATABASE_URL if set
if [ -n "$DATABASE_URL" ]; then
  DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')
  DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
  DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
fi

PREFIX="{{projectName}}"

# Detect docker or podman
if ! [ -x "$(command -v docker)" ] && ! [ -x "$(command -v podman)" ]; then
  echo "Docker or Podman is not installed."
  echo "  Docker: https://docs.docker.com/engine/install/"
  echo "  Podman: https://podman.io/getting-started/installation"
  exit 1
fi

if [ -x "$(command -v docker)" ]; then
  DOCKER_CMD="docker"
elif [ -x "$(command -v podman)" ]; then
  DOCKER_CMD="podman"
fi

if ! $DOCKER_CMD info > /dev/null 2>&1; then
  echo "$DOCKER_CMD daemon is not running. Please start $DOCKER_CMD and try again."
  exit 1
fi

# Helper: start or create a container
start_service() {
  local name="$1"
  local port="$2"
  shift 2

  # Already running
  if [ "$($DOCKER_CMD ps -q -f name="$name")" ]; then
    echo "✓ $name already running"
    return
  fi

  # Exists but stopped
  if [ "$($DOCKER_CMD ps -q -a -f name="$name")" ]; then
    $DOCKER_CMD start "$name" > /dev/null
    echo "✓ $name started (existing container)"
    return
  fi

  # Check port
  if command -v nc >/dev/null 2>&1; then
    if nc -z localhost "$port" 2>/dev/null; then
      echo "⚠ Port $port already in use, skipping $name"
      return
    fi
  fi

  # Create new
  $DOCKER_CMD run -d --name "$name" "$@" > /dev/null
  echo "✓ $name created"
}

echo "Starting infrastructure..."
echo ""

# PostgreSQL
start_service "${PREFIX}-postgres" "$DB_PORT" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "$DB_PORT":5432 \
  docker.io/postgres:18-alpine

# Redis
start_service "${PREFIX}-redis" "$REDIS_PORT" \
  -p "$REDIS_PORT":6379 \
  docker.io/redis:8-alpine

# RabbitMQ
start_service "${PREFIX}-rabbitmq" "$RABBITMQ_PORT" \
  -p "$RABBITMQ_PORT":5672 \
  -p "$RABBITMQ_MGMT_PORT":15672 \
  docker.io/rabbitmq:4-management-alpine

# SeaweedFS (S3-compatible)
start_service "${PREFIX}-seaweedfs" "$S3_PORT" \
  -p "$S3_PORT":8333 \
  docker.io/chrislusf/seaweedfs:latest \
  server -s3 -dir=/data

echo ""
echo "All services ready."
