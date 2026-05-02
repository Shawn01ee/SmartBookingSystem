# Asterion Macro

Multi-asset FX dashboard and quant backend for exchange rates, US Treasuries, equities, and macro-aware forecasting.

## Project structure

- `fx-dashboard/`: browser UI and client-side visualization layer
- `quant-pipeline/`: FastAPI + quant research/backend layer
- `smart-booking-system/`: restaurant reservation system with waitlist and payment TTL
- `run_fx_dashboard.sh`: start the full local app
- `setup_fx_dashboard.sh`: create the Python environment and install dependencies
- `Dockerfile`: containerized runtime for publishing or sharing

## Quick start

```bash
./setup_fx_dashboard.sh
./run_fx_dashboard.sh
```

Open:

- `http://127.0.0.1:8787/dashboard/`

## Portable run options

Expose to the local network:

```bash
BIND_HOST=0.0.0.0 BIND_PORT=8787 ./run_fx_dashboard.sh
```

Run with Docker:

```bash
docker build -t asterion-macro .
docker run --rm -p 8787:8787 asterion-macro
```

## Publish surface

If you are reviewing or publishing this repository, the main files to inspect first are:

- `fx-dashboard/index.html`
- `fx-dashboard/styles.css`
- `fx-dashboard/app.js`
- `quant-pipeline/src/quant_pipeline/api/app.py`
- `quant-pipeline/src/quant_pipeline/pipelines/data/nodes.py`
- `quant-pipeline/src/quant_pipeline/pipelines/signals/nodes.py`
- `smart-booking-system/app/main.py`
- `smart-booking-system/app/engine.py`
