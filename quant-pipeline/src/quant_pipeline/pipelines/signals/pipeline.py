from __future__ import annotations

from kedro.pipeline import Pipeline, node, pipeline

from .nodes import (
    build_alpha_vector,
    build_forecast_package,
    build_return_matrix,
    construct_portfolio,
    estimate_covariance_matrix,
)


def create_pipeline(**kwargs) -> Pipeline:
    return pipeline(
        [
            node(
                func=build_return_matrix,
                inputs="market_data",
                outputs="return_matrix",
                name="build_return_matrix",
            ),
            node(
                func=build_alpha_vector,
                inputs=["return_matrix", "params:portfolio"],
                outputs="alpha_vector",
                name="build_alpha_vector",
            ),
            node(
                func=estimate_covariance_matrix,
                inputs=["return_matrix", "params:portfolio"],
                outputs="covariance_matrix",
                name="estimate_covariance_matrix",
            ),
            node(
                func=construct_portfolio,
                inputs=["alpha_vector", "covariance_matrix", "return_matrix", "params:portfolio"],
                outputs="portfolio_result",
                name="construct_portfolio",
            ),
            node(
                func=build_forecast_package,
                inputs=["market_data", "params:timesfm"],
                outputs="forecast_package",
                name="build_forecast_package",
            ),
        ]
    )

