#!/usr/bin/env bash
# Start Docker containers for local development infrastructure
# Supports both Docker and Podman
#
# Usage:
#   ./start-docker.sh              # start all services
#   ./start-docker.sh postgres     # start only PostgreSQL
#   ./start-docker.sh postgres redis  # start PostgreSQL and Redis
#
# Available services: postgres, redis, rabbitmq, seaweedfs

# Load .env if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

set -euo pipefail

# Defaults (match .env.example)
DB_PORT=${DB_PORT:-5432}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-{{projectName}}}
REDIS_PORT=${REDIS_PORT:-6379}
RABBITMQ_PORT=${RABBITMQ_PORT:-5672}
RABBITMQ_MGMT_PORT=${RABBITMQ_MGMT_PORT:-15672}
S3_PORT=${S3_PORT:-8333}

# Parse DATABASE_URL if set
if [ -n "${DATABASE_URL:-}" ]; then
  DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')
  DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
  DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
fi

PREFIX="{{projectName}}"
ALL_SERVICES="postgres redis rabbitmq seaweedfs"
REQUESTED="${*:-$ALL_SERVICES}"

# Detect docker or podman
if ! command -v docker &>/dev/null && ! command -v podman &>/dev/null; then
  echo "Error: Docker or Podman is not installed."
  echo "  Docker: https://docs.docker.com/engine/install/"
  echo "  Podman: https://podman.io/getting-started/installation"
  exit 1
fi

if command -v docker &>/dev/null; then
  DOCKER_CMD="docker"
else
  DOCKER_CMD="podman"
fi

if ! $DOCKER_CMD info &>/dev/null; then
  echo "Error: $DOCKER_CMD daemon is not running. Please start $DOCKER_CMD and try again."
  exit 1
fi

check_port() {
  local port="$1"
  local service="$2"
  if command -v nc &>/dev/null; then
    if nc -z localhost "$port" 2>/dev/null; then
      echo "Error: Port $port is already in use. Cannot start $service."
      echo "  Either stop the service using that port, or change the port in .env"
      exit 1
    fi
  fi
}

start_service() {
  local name="$1"
  local port="$2"
  shift 2

  # Already running
  if [ "$($DOCKER_CMD ps -q -f name="^${name}$")" ]; then
    echo "✓ $name already running"
    return
  fi

  # Exists but stopped
  if [ "$($DOCKER_CMD ps -q -a -f name="^${name}$")" ]; then
    $DOCKER_CMD start "$name" > /dev/null
    echo "✓ $name started"
    return
  fi

  # Port must be free
  check_port "$port" "$name"

  # Create new
  $DOCKER_CMD run -d --name "$name" "$@" > /dev/null
  echo "✓ $name created"
}

echo "Starting infrastructure..."
echo ""

for service in $REQUESTED; do
  case "$service" in
    postgres)
      start_service "${PREFIX}-postgres" "$DB_PORT" \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD="$DB_PASSWORD" \
        -e POSTGRES_DB="$DB_NAME" \
        -p "$DB_PORT":5432 \
        docker.io/postgres:18-alpine
      ;;
    redis)
      start_service "${PREFIX}-redis" "$REDIS_PORT" \
        -p "$REDIS_PORT":6379 \
        docker.io/redis:8-alpine
      ;;
    rabbitmq)
      start_service "${PREFIX}-rabbitmq" "$RABBITMQ_PORT" \
        -p "$RABBITMQ_PORT":5672 \
        -p "$RABBITMQ_MGMT_PORT":15672 \
        docker.io/rabbitmq:4-management-alpine
      ;;
    seaweedfs)
      start_service "${PREFIX}-seaweedfs" "$S3_PORT" \
        -p "$S3_PORT":8333 \
        docker.io/chrislusf/seaweedfs:latest \
        server -s3 -dir=/data
      ;;
    *)
      echo "Unknown service: $service"
      echo "Available: postgres, redis, rabbitmq, seaweedfs"
      exit 1
      ;;
  esac
done

echo ""
echo "All services ready."
