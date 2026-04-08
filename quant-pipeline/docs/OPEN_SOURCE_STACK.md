# Open Source Stack

## Adopted components

### Kedro

Use for:

- data ingestion pipelines
- feature engineering
- backtest pipeline standardization
- modular node composition

Why here:

Kedro is the backbone for turning the current dashboard logic into a reproducible research/backend workflow.

Official references:

- [Kedro GitHub](https://github.com/kedro-org/kedro)
- [Kedro docs](https://docs.kedro.org/)
- [Kedro 1.0 announcement](https://medium.com/quantumblack/announcing-kedro-1-921fa69c8af9)
- [McKinsey OSS ecosystem](https://www.mckinsey.com/about-us/new-at-mckinsey-blog/mckinsey-launches-an-open-source-ecosystem)

### Kedro-Viz

Use for:

- pipeline graph inspection
- parameter/debug visibility
- sharing pipeline structure with non-engineers

How to run:

```bash
cd /Users/lsm01/SLCSPJ/quant-pipeline
source .venv/bin/activate
kedro viz run --no-browser
```

Official references:

- [Kedro-Viz GitHub](https://github.com/kedro-org/kedro-viz)

### TimesFM 2.5

Use for:

- long-horizon baseline forecasting
- comparing handcrafted alpha/risk models against a foundation-model forecast

Current integration:

- wrapped behind `quant_pipeline.models.timesfm_adapter`
- graceful fallback when unavailable

Official references:

- [TimesFM GitHub](https://github.com/google-research/timesfm)

### Jane Street magic-trace

Use for:

- CPU-bound performance profiling of backend processes
- tracing slow data/feature/portfolio computation segments

Constraint:

- Linux only
- Intel Skylake or newer
- not expected to run in this macOS workspace directly

Official references:

- [magic-trace GitHub](https://github.com/janestreet/magic-trace)
- [OxCaml announcement](https://blog.janestreet.com/introducing-oxcaml/)

## Why not deeper Jane Street OCaml adoption?

`Base`, `Core`, `Async`, and `Bonsai` are strong projects, but they do not fit the current Python/Kedro/web stack well enough to justify direct adoption in this repository.

## McKinsey / QuantumBlack fit

Kedro is the closest direct fit to the requested research workflow. It standardizes data, features, and backtests while staying compatible with Python-first quant infrastructure.
