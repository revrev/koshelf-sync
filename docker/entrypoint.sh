#!/usr/bin/env bash
set -euo pipefail

ensure_directories() {
    mkdir -p /var/log/redis /var/lib/redis /var/run
}

start_redis() {
    redis-server /app/koshelf-sync/config/redis.conf &
    echo $! > /var/run/redis-server.pid
}

wait_for_redis() {
    for _ in $(seq 1 30); do
        if redis-cli ping >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

cleanup() {
    if [[ -f /var/run/redis-server.pid ]]; then
        local redis_pid
        redis_pid=$(cat /var/run/redis-server.pid)
        if kill -0 "${redis_pid}" >/dev/null 2>&1; then
            kill "${redis_pid}" >/dev/null 2>&1 || true
            wait "${redis_pid}" 2>/dev/null || true
        fi
    fi
}

trap cleanup EXIT HUP INT TERM

ensure_directories
start_redis
if ! wait_for_redis; then
    echo "Redis failed to start within the allowed time." >&2
    exit 1
fi

cd /app/koshelf-sync
exec gin start
