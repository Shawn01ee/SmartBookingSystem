# quant-pipeline

Kedro-style research/backend skeleton for the multi-asset dashboard.

## What it adds

- FX + equities + bonds data ingestion layer
- Signal/feature layer for alpha generation
- Risk model using covariance and EWMA volatility
- Portfolio construction using `w ∝ Σ^-1 α`
- Volatility targeting, turnover penalty, and ES guardrails
- Optional TimesFM adapter for long-horizon forecasting

## Important runtime note

Use Python `3.11` when possible. The dashboard API and the research stack are packaged so the project can be moved to another computer without keeping the original absolute path.

Recommended setup from the repository root:

```bash
./setup_fx_dashboard.sh
```

Optional TimesFM install:

```bash
INSTALL_FORECAST=1 ./setup_fx_dashboard.sh
```

If you prefer manual installation:

```bash
cd quant-pipeline
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

## Layout

- `conf/base/parameters.yml`: research and risk parameters
- `src/quant_pipeline/pipelines/data`: market data ingestion nodes
- `src/quant_pipeline/pipelines/signals`: alpha, covariance, and portfolio logic
- `src/quant_pipeline/models/timesfm_adapter.py`: optional wrapper around TimesFM

## Execution idea

When Kedro is installed, the intended flow is:

1. ingest market data
2. build signal features
3. estimate covariance / volatility
4. construct portfolio with risk controls
5. optionally forecast with TimesFM

## Run the dashboard API locally

From the repository root:

```bash
./run_fx_dashboard.sh
```

Then open:

- `http://127.0.0.1:8787/dashboard/`

If you want to expose it to another device on the same network:

```bash
BIND_HOST=0.0.0.0 BIND_PORT=8787 ./run_fx_dashboard.sh
```

## Daily refresh behavior

The backend now has a background scheduler. While the server is running, it refreshes configured FX pairs every hour and writes daily snapshot files under:

- `quant-pipeline/data/snapshots/<BASE>_<TARGET>/latest.json`
- `quant-pipeline/data/snapshots/<BASE>_<TARGET>/YYYY-MM-DD.json`

Important:

- The server process must stay running for automatic daily refresh to happen.
- The default scheduled pairs come from `conf/base/parameters.yml -> assets.fx_pairs`.

## Run with Docker

From the repository root:

```bash
docker build -t asterion-macro .
docker run --rm -p 8787:8787 asterion-macro
```
