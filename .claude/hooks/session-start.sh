#!/usr/bin/env bash
# SessionStart hook: make sure a fresh cloud/web checkout is ready to run tests,
# typecheck, lint, and build. Idempotent and fast — skips install when
# node_modules is already present.
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ -d node_modules ]; then
  echo "[session-start] node_modules present — skipping install."
  exit 0
fi

echo "[session-start] Installing dependencies..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
echo "[session-start] Dependencies ready."
