"""Pipeline registry."""

from __future__ import annotations

from kedro.pipeline import Pipeline

from quant_pipeline.pipelines.data.pipeline import create_pipeline as create_data_pipeline
from quant_pipeline.pipelines.signals.pipeline import create_pipeline as create_signal_pipeline


def register_pipelines() -> dict[str, Pipeline]:
    data_pipeline = create_data_pipeline()
    signal_pipeline = create_signal_pipeline()
    default = data_pipeline + signal_pipeline
    return {
        "__default__": default,
        "data": data_pipeline,
        "signals": signal_pipeline,
    }

