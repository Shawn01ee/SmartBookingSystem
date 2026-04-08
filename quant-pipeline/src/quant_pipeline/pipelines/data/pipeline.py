from __future__ import annotations

from kedro.pipeline import Pipeline, node, pipeline

from .nodes import fetch_multi_asset_market_data


def create_pipeline(**kwargs) -> Pipeline:
    return pipeline(
        [
            node(
                func=fetch_multi_asset_market_data,
                inputs="params:assets",
                outputs="market_data",
                name="fetch_multi_asset_market_data",
            ),
        ]
    )

