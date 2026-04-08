from __future__ import annotations

import json


def main() -> None:
    summary = {
        "stack": {
            "pipeline": "Kedro",
            "viz": "Kedro-Viz",
            "forecast": "TimesFM (optional adapter)",
            "profiling": "magic-trace (Linux/Intel only)",
        },
        "core_formulae": [
            "w_raw = Sigma^-1 alpha",
            "w_scaled = w_raw * sigma_target / sigma_portfolio",
            "ES_alpha <= limit",
            "alpha_net = alpha_gross - turnover_cost",
        ],
    }
    print(json.dumps(summary, indent=2))

