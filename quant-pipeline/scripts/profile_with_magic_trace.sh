#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "magic-trace is only supported on Linux." >&2
  exit 1
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  echo "magic-trace expects Intel x86_64 hardware." >&2
  exit 1
fi

if ! command -v magic-trace >/dev/null 2>&1; then
  echo "magic-trace binary not found. Install it from the official releases first." >&2
  exit 1
fi

exec magic-trace -- kedro run

