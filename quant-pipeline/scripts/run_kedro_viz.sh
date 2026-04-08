#!/usr/bin/env bash
set -euo pipefail

if ! command -v kedro >/dev/null 2>&1; then
  echo "kedro is not installed in the current environment." >&2
  exit 1
fi

exec kedro viz run --no-browser
