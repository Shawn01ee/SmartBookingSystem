"""Optional TimesFM adapter.

This module deliberately degrades gracefully when TimesFM is unavailable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np


@dataclass
class TimesFMForecastResult:
    values: np.ndarray
    used_timesfm: bool
    message: str


def forecast_series(values: np.ndarray, horizon: int, context_length: int) -> TimesFMForecastResult:
    series = np.asarray(values, dtype=float)
    if series.size == 0:
        return TimesFMForecastResult(values=np.array([]), used_timesfm=False, message="empty-series")

    try:
        import timesfm  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        fallback = np.repeat(series[-1], horizon)
        return TimesFMForecastResult(
            values=fallback,
            used_timesfm=False,
            message=f"timesfm-unavailable:{exc}",
        )

    try:  # pragma: no cover - optional dependency
        model = timesfm.TimesFm(
            context_len=context_length,
            horizon_len=horizon,
            input_patch_len=32,
            output_patch_len=128,
            num_layers=20,
            model_dims=1280,
            backend="cpu",
        )
        forecast, _ = model.forecast([series.tolist()])
        return TimesFMForecastResult(
            values=np.asarray(forecast[0], dtype=float),
            used_timesfm=True,
            message="ok",
        )
    except Exception as exc:
        fallback = np.repeat(series[-1], horizon)
        return TimesFMForecastResult(
            values=fallback,
            used_timesfm=False,
            message=f"timesfm-failed:{exc}",
        )
