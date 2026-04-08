#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIPELINE_DIR="$ROOT_DIR/quant-pipeline"
VENV_DIR="$PIPELINE_DIR/.venv"
INSTALL_TARGET=".[forecast]"

if [[ "${INSTALL_FORECAST:-0}" != "1" ]]; then
  INSTALL_TARGET="."
fi

if [[ -n "${PYTHON_BIN:-}" ]]; then
  PYTHON="$PYTHON_BIN"
elif command -v python3.11 >/dev/null 2>&1; then
  PYTHON="python3.11"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  echo "python3.11 또는 python3 를 찾지 못했습니다."
  exit 1
fi

echo "Using Python: $PYTHON"
cd "$PIPELINE_DIR"

if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e "$INSTALL_TARGET"

echo ""
echo "Setup complete."
echo "Run the dashboard with:"
echo "  $ROOT_DIR/run_fx_dashboard.sh"
echo ""
echo "If you want LAN access from another device:"
echo "  BIND_HOST=0.0.0.0 BIND_PORT=8787 $ROOT_DIR/run_fx_dashboard.sh"
