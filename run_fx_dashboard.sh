#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIPELINE_DIR="$ROOT_DIR/quant-pipeline"
VENV_BIN="$PIPELINE_DIR/.venv/bin"
BIND_HOST="${BIND_HOST:-127.0.0.1}"
BIND_PORT="${BIND_PORT:-8787}"

if [[ ! -x "$VENV_BIN/uvicorn" ]]; then
  echo "가상환경이 준비되지 않았습니다: $VENV_BIN/uvicorn"
  echo "먼저 $ROOT_DIR/setup_fx_dashboard.sh 를 실행해 주세요."
  exit 1
fi

cd "$PIPELINE_DIR"
export UV_CACHE_DIR="$PIPELINE_DIR/.uv-cache"

echo "FX dashboard server starting on http://$BIND_HOST:$BIND_PORT/dashboard/"
exec "$VENV_BIN/uvicorn" quant_pipeline.api.app:app --host "$BIND_HOST" --port "$BIND_PORT"
