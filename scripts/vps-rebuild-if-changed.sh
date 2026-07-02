#!/bin/bash
#
# Rebuild dist/ on the VPS if origin/main has new commits.
#
# Idempotent — safe to call frequently. Returns immediately when there's
# nothing new, only runs `npm ci && npm run build` when origin has advanced.
# This makes us robust to GitHub Action scheduling jitter (the daily WOD
# action is supposed to run at 14:00 UTC but can be 10min-2h late).
#
# Intended cron schedule: every 30 min between 14:00 and 22:00 UTC, as
# user `autosterea`. See /etc/cron.d/crossfit-wod-rebuild.

set -euo pipefail

REPO=/opt/crossfit-wod-intel
LOG=/var/log/crossfit-wod-rebuild.log

cd "$REPO"

# Fetch quietly; abort cleanly on transient network failures
if ! git fetch origin main --quiet 2>>"$LOG"; then
  echo "[$(date -u +%FT%TZ)] git fetch failed (transient?)" >> "$LOG"
  exit 0
fi

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  # No new commits — nothing to do
  exit 0
fi

echo "[$(date -u +%FT%TZ)] new commit detected: $LOCAL -> $REMOTE" >> "$LOG"

# Pull, install (only if package-lock changed), build
git pull --ff-only >> "$LOG" 2>&1

# Only run npm ci if dependencies actually changed — speeds up the common case
if ! git diff --quiet "$LOCAL" "$REMOTE" -- package-lock.json package.json; then
  echo "[$(date -u +%FT%TZ)] deps changed, running npm ci" >> "$LOG"
  npm ci --silent >> "$LOG" 2>&1
fi

npm run build >> "$LOG" 2>&1
echo "[$(date -u +%FT%TZ)] rebuilt ok ($(git rev-parse --short HEAD))" >> "$LOG"
