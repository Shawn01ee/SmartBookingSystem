from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import numpy as np
import pandas as pd

from quant_pipeline.models.timesfm_adapter import forecast_series


@dataclass
class PortfolioResult:
    weights: dict[str, float]
    raw_weights: dict[str, float]
    expected_shortfall: float
    portfolio_volatility: float
    gross_exposure: float
    turnover_penalty: float


def build_return_matrix(market_data: dict[str, pd.DataFrame]) -> pd.DataFrame:
    frames = []
    for domain, frame in market_data.items():
        if domain == "macro":
            continue
        pivot = frame.pivot_table(index="date", columns="asset", values="close").sort_index()
        if not pivot.empty:
            frames.append(pivot)
    if not frames:
        return pd.DataFrame()
    prices = pd.concat(frames, axis=1).sort_index().ffill().dropna(how="all")
    if prices.empty:
        return pd.DataFrame()
    returns = np.log(prices / prices.shift(1))
    returns = returns.replace([np.inf, -np.inf], np.nan).clip(lower=-0.25, upper=0.25)
    returns = returns.dropna(how="all").fillna(0.0)
    return returns.dropna(axis=1, how="all")


def build_alpha_vector(return_matrix: pd.DataFrame, portfolio_params: dict[str, Any]) -> pd.Series:
    recent_21 = return_matrix.tail(21).mean()
    recent_63 = return_matrix.tail(63).mean()
    recent_126 = return_matrix.tail(126).mean()
    alpha = recent_21 * 12 + recent_63 * 6 + recent_126 * 3
    return alpha.fillna(0.0)


def estimate_covariance_matrix(return_matrix: pd.DataFrame, portfolio_params: dict[str, Any]) -> pd.DataFrame:
    lookback = int(portfolio_params["covariance_lookback"])
    lam = float(portfolio_params["ewma_lambda"])
    sample = return_matrix.tail(lookback).fillna(0.0)
    if sample.empty or sample.shape[1] == 0:
        return pd.DataFrame()
    cols = sample.columns
    cov = np.cov(sample.to_numpy().T)
    ewma_scale = np.ones(cov.shape[0])

    for idx, col in enumerate(cols):
        values = sample[col].to_numpy(dtype=float)
        variance = values[0] ** 2 if values.size else 0.0
        for value in values[1:]:
            variance = lam * variance + (1 - lam) * value**2
        ewma_scale[idx] = max(variance, 1e-8)

    scaled = cov.copy()
    for idx in range(len(cols)):
        scaled[idx, idx] = ewma_scale[idx]
    return pd.DataFrame(scaled, index=cols, columns=cols)


def construct_portfolio(
    alpha_vector: pd.Series,
    covariance_matrix: pd.DataFrame,
    return_matrix: pd.DataFrame,
    portfolio_params: dict[str, Any],
) -> dict[str, Any]:
    if covariance_matrix.empty or covariance_matrix.shape[0] == 0 or alpha_vector.empty:
        return asdict(
            PortfolioResult(
                weights={},
                raw_weights={},
                expected_shortfall=0.0,
                portfolio_volatility=0.0,
                gross_exposure=0.0,
                turnover_penalty=0.0,
            )
        )

    alpha = alpha_vector.reindex(covariance_matrix.columns).fillna(0.0).to_numpy(dtype=float)
    sigma = covariance_matrix.to_numpy(dtype=float)
    sigma = _regularize_covariance(sigma)
    with np.errstate(all="ignore"):
        inv_sigma = np.linalg.pinv(sigma)
        raw = inv_sigma @ alpha
    raw = np.clip(np.nan_to_num(raw, nan=0.0, posinf=0.0, neginf=0.0), -25.0, 25.0)

    with np.errstate(all="ignore"):
        portfolio_var = float(raw.T @ sigma @ raw)
    if not np.isfinite(portfolio_var):
        portfolio_var = 1e-12
    portfolio_vol = float(np.sqrt(max(portfolio_var, 1e-12)) * np.sqrt(252))
    target_vol = float(portfolio_params["target_volatility"])
    scaled = raw * (target_vol / portfolio_vol if portfolio_vol > 0 else 0.0)
    scaled = np.clip(np.nan_to_num(scaled, nan=0.0, posinf=0.0, neginf=0.0), -1.5, 1.5)

    turnover_penalty = float(portfolio_params["turnover_penalty"]) * float(np.abs(scaled).sum())
    scaled = np.sign(scaled) * np.maximum(np.abs(scaled) - turnover_penalty, 0.0)
    gross_exposure = float(np.abs(scaled).sum())
    if gross_exposure > 3.0 and gross_exposure > 0:
        scaled *= 3.0 / gross_exposure

    safe_returns_matrix = np.nan_to_num(
        return_matrix.reindex(columns=covariance_matrix.columns).fillna(0.0).to_numpy(dtype=float),
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )
    safe_returns_matrix = np.clip(safe_returns_matrix, -0.25, 0.25)
    with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
        portfolio_returns = safe_returns_matrix @ scaled
    portfolio_returns = np.nan_to_num(portfolio_returns, nan=0.0, posinf=0.0, neginf=0.0)
    expected_shortfall = _expected_shortfall(portfolio_returns, float(portfolio_params["confidence_level"]))
    es_limit = float(portfolio_params["expected_shortfall_limit"])
    if expected_shortfall > es_limit and expected_shortfall > 0:
        scaled *= es_limit / expected_shortfall

    result = PortfolioResult(
        weights=dict(zip(covariance_matrix.columns, scaled.round(6))),
        raw_weights=dict(zip(covariance_matrix.columns, raw.round(6))),
        expected_shortfall=float(expected_shortfall),
        portfolio_volatility=float(_portfolio_volatility(scaled, sigma)),
        gross_exposure=float(np.abs(scaled).sum()),
        turnover_penalty=float(turnover_penalty),
    )
    return asdict(result)


def build_forecast_package(market_data: dict[str, pd.DataFrame], timesfm_params: dict[str, Any]) -> dict[str, Any]:
    enabled = bool(timesfm_params["enabled"])
    horizon = int(timesfm_params["horizon"])
    context_length = int(timesfm_params["context_length"])
    forecasts: dict[str, Any] = {}

    if not enabled:
        return {"enabled": False, "forecasts": forecasts}

    for domain, frame in market_data.items():
        if domain == "macro":
            continue
        pivot = frame.pivot_table(index="date", columns="asset", values="close").sort_index()
        for asset in pivot.columns:
            series = pivot[asset].dropna().to_numpy(dtype=float)
            result = forecast_series(series, horizon=horizon, context_length=context_length)
            forecasts[asset] = {
                "used_timesfm": result.used_timesfm,
                "message": result.message,
                "forecast": result.values.tolist(),
                "domain": domain,
            }
    return {"enabled": True, "forecasts": forecasts}


def build_forecast_backtest(
    market_data: dict[str, pd.DataFrame],
    target_asset: str,
    backtest_params: dict[str, Any],
) -> dict[str, Any]:
    price_series = _extract_price_series(market_data, target_asset)
    if price_series.empty:
        return {"enabled": False, "target_asset": target_asset, "reason": "missing target asset series"}

    lookback = int(backtest_params["lookback"])
    step = int(backtest_params["step"])
    min_signal = float(backtest_params["min_signal_threshold"])
    horizons = [int(value) for value in backtest_params["horizons"]]
    max_annual_drift = float(backtest_params["max_annual_drift"])

    metrics_by_horizon: dict[str, Any] = {}
    for horizon in horizons:
        metrics_by_horizon[str(horizon)] = _walk_forward_metrics(
            price_series=price_series,
            lookback=lookback,
            horizon=horizon,
            step=step,
            min_signal=min_signal,
            max_annual_drift=max_annual_drift,
        )

    primary_horizon = str(horizons[1] if len(horizons) > 1 else horizons[0])
    return {
        "enabled": True,
        "target_asset": target_asset,
        "primary_horizon": int(primary_horizon),
        "by_horizon": metrics_by_horizon,
    }


def build_cross_asset_signal(market_data: dict[str, pd.DataFrame], target_asset: str) -> dict[str, Any]:
    series_map = _build_asset_series_map(market_data)
    fx_series = series_map.get(target_asset, pd.Series(dtype=float))
    spy_series = series_map.get("SPY", pd.Series(dtype=float))
    aapl_series = series_map.get("AAPL", pd.Series(dtype=float))
    dxy_series = series_map.get("DXY", pd.Series(dtype=float))
    vix_series = series_map.get("VIX", pd.Series(dtype=float))
    wti_series = series_map.get("WTI", pd.Series(dtype=float))
    dff_series = series_map.get("DFF", pd.Series(dtype=float))
    us2y_series = series_map.get("US2Y", pd.Series(dtype=float))
    us10y_series = series_map.get("US10Y", pd.Series(dtype=float))
    us3m_series = series_map.get("US3M", pd.Series(dtype=float))
    us5y_series = series_map.get("US5Y", pd.Series(dtype=float))

    fx_mom = _series_momentum(fx_series, 21)
    spy_mom = _series_momentum(spy_series, 21)
    aapl_mom = _series_momentum(aapl_series, 21)
    dxy_mom = _series_momentum(dxy_series, 21)
    wti_mom = _series_momentum(wti_series, 21)
    vix_change = _series_change(vix_series, 5)
    us2y_change = _series_change(us2y_series, 21)
    us10y_change = _series_change(us10y_series, 21)
    us3m_change = _series_change(us3m_series, 21)
    curve_slope = _latest_value(us10y_series) - _latest_value(us2y_series)
    fed_path_proxy = (
        0.55 * (_latest_value(us2y_series) - _latest_value(dff_series))
        + 0.30 * (_latest_value(us5y_series) - _latest_value(us2y_series))
        + 0.15 * (_latest_value(us3m_series) - _latest_value(dff_series))
    )
    usd_orientation = _usd_orientation(target_asset)

    equity_signal = 0.55 * spy_mom + 0.45 * aapl_mom
    rate_signal = -0.45 * us2y_change - 0.20 * us10y_change - 0.10 * us3m_change + 0.20 * curve_slope + 0.35 * fed_path_proxy
    macro_signal = usd_orientation * (0.45 * dxy_mom - 0.30 * (vix_change / 100.0) + 0.25 * wti_mom)
    fx_signal = fx_mom
    composite = 0.30 * fx_signal + 0.25 * equity_signal + 0.20 * rate_signal + 0.25 * macro_signal

    if composite >= 0.012:
        action = "LONG"
        detail = "High-conviction upside regime"
    elif composite <= -0.012:
        action = "SHORT"
        detail = "High-conviction downside regime"
    else:
        action = "HOLD"
        detail = "Signal is mixed, hold bias"

    return {
        "target_asset": target_asset,
        "fx_momentum": float(fx_signal),
        "spy_momentum": float(spy_mom),
        "aapl_momentum": float(aapl_mom),
        "dxy_momentum": float(dxy_mom),
        "vix_change": float(vix_change),
        "wti_momentum": float(wti_mom),
        "us2y_change": float(us2y_change),
        "us10y_change": float(us10y_change),
        "fed_path_proxy": float(fed_path_proxy),
        "curve_slope": float(curve_slope),
        "macro_signal": float(macro_signal),
        "composite_signal": float(composite),
        "action": action,
        "detail": detail,
    }


def build_short_term_model(
    market_data: dict[str, pd.DataFrame],
    target_asset: str,
    short_term_params: dict[str, Any],
) -> dict[str, Any]:
    series_map = _build_asset_series_map(market_data)
    fx_series = series_map.get(target_asset, pd.Series(dtype=float))
    spy_series = series_map.get("SPY", pd.Series(dtype=float))
    aapl_series = series_map.get("AAPL", pd.Series(dtype=float))
    dxy_series = series_map.get("DXY", pd.Series(dtype=float))
    vix_series = series_map.get("VIX", pd.Series(dtype=float))
    wti_series = series_map.get("WTI", pd.Series(dtype=float))
    dff_series = series_map.get("DFF", pd.Series(dtype=float))
    sofr_series = series_map.get("SOFR", pd.Series(dtype=float))
    us3m_series = series_map.get("US3M", pd.Series(dtype=float))
    us5y_series = series_map.get("US5Y", pd.Series(dtype=float))
    us2y_series = series_map.get("US2Y", pd.Series(dtype=float))
    us10y_series = series_map.get("US10Y", pd.Series(dtype=float))

    if fx_series.empty:
        return {"enabled": False, "target_asset": target_asset, "reason": "missing target asset series"}

    missing_inputs = [
        name
        for name, series in {
            "SPY": spy_series,
            "AAPL": aapl_series,
            "DXY": dxy_series,
            "VIX": vix_series,
            "WTI": wti_series,
            "DFF": dff_series,
            "SOFR": sofr_series,
            "US3M": us3m_series,
            "US5Y": us5y_series,
            "US2Y": us2y_series,
            "US10Y": us10y_series,
        }.items()
        if series.empty
    ]

    horizons = [int(value) for value in short_term_params["horizons"]]
    lookback = int(short_term_params["lookback"])
    step = int(short_term_params["step"])
    max_expected_move = float(short_term_params["max_expected_move"])
    train_window = int(short_term_params["train_window"])
    ridge_alpha = float(short_term_params["ridge_alpha"])

    aligned = _build_short_term_aligned_frame(
        fx_series=fx_series,
        spy_series=spy_series,
        aapl_series=aapl_series,
        dxy_series=dxy_series,
        vix_series=vix_series,
        wti_series=wti_series,
        dff_series=dff_series,
        sofr_series=sofr_series,
        us3m_series=us3m_series,
        us5y_series=us5y_series,
        us2y_series=us2y_series,
        us10y_series=us10y_series,
    )
    if aligned.empty:
        return {
            "enabled": True,
            "status": "degraded",
            "target_asset": target_asset,
            "formula": "r_hat(h) = beta0 + beta'X_t, with degraded fallback because the aligned feature frame is unavailable",
            "latest_signal": {"feature_score": 0.0, "expected_return": 0.0, "confidence_score": 0.0, "drivers": []},
            "forecasts": {str(horizon): {
                "expected_return": 0.0,
                "forecast_price": float(fx_series.iloc[-1]),
                "direction": "FLAT",
                "feature_score": 0.0,
                "confidence_score": 0.0,
                "drivers": [],
            } for horizon in horizons},
            "backtest": {str(horizon): {"samples": 0, "rmse": 0.0, "mae": 0.0, "hit_rate": 0.0, "last_case": None} for horizon in horizons},
            "missing_inputs": missing_inputs,
        }
    datasets = {horizon: _build_short_term_dataset(aligned, horizon) for horizon in horizons}
    latest_price = float(fx_series.iloc[-1])
    latest_signal = _build_short_term_signal(
        dataset=datasets[horizons[0]],
        horizon=horizons[0],
        train_window=train_window,
        ridge_alpha=ridge_alpha,
        max_expected_move=max_expected_move,
    )

    forecasts = {}
    for horizon in horizons:
        horizon_signal = _build_short_term_signal(
            dataset=datasets[horizon],
            horizon=horizon,
            train_window=train_window,
            ridge_alpha=ridge_alpha,
            max_expected_move=max_expected_move,
        )
        expected_return = float(horizon_signal["expected_return"])
        forecast_price = latest_price * float(np.exp(expected_return))
        forecasts[str(horizon)] = {
            "expected_return": float(expected_return),
            "forecast_price": float(forecast_price),
            "direction": "UP" if expected_return > 0 else "DOWN" if expected_return < 0 else "FLAT",
            "feature_score": float(horizon_signal["feature_score"]),
            "confidence_score": float(horizon_signal["confidence_score"]),
            "drivers": horizon_signal["drivers"],
        }

    backtest = {
        str(horizon): _run_short_term_backtest(
            dataset=datasets[horizon],
            lookback=lookback,
            step=step,
            train_window=train_window,
            ridge_alpha=ridge_alpha,
            max_expected_move=max_expected_move,
        )
        for horizon in horizons
    }

    return {
        "enabled": True,
        "status": "degraded" if missing_inputs else "ready",
        "target_asset": target_asset,
        "formula": "r_hat(h) = beta0 + beta'X_t, with beta fit by rolling ridge regression on FX, DXY, VIX, WTI, Fed-path proxy, rates, curve, equities, and volatility features",
        "latest_signal": latest_signal,
        "forecasts": forecasts,
        "backtest": backtest,
        "missing_inputs": missing_inputs,
    }


def _expected_shortfall(returns: np.ndarray, confidence_level: float) -> float:
    if returns.size == 0:
        return 0.0
    cutoff = np.quantile(returns, 1 - confidence_level)
    tail = returns[returns <= cutoff]
    if tail.size == 0:
        return 0.0
    return float(abs(tail.mean()))


def _portfolio_volatility(weights: np.ndarray, covariance: np.ndarray) -> float:
    return float(np.sqrt(max(weights.T @ covariance @ weights, 1e-12)) * np.sqrt(252))


def _regularize_covariance(covariance: np.ndarray) -> np.ndarray:
    covariance = np.nan_to_num(covariance, nan=0.0, posinf=0.0, neginf=0.0)
    diagonal_floor = np.maximum(np.diag(covariance), 1e-6)
    regularized = covariance.copy()
    np.fill_diagonal(regularized, diagonal_floor + 1e-6)
    return regularized


def _extract_price_series(market_data: dict[str, pd.DataFrame], asset: str) -> pd.Series:
    frames = []
    for frame in market_data.values():
        if frame.empty:
            continue
        sample = frame.loc[frame["asset"] == asset, ["date", "close"]].copy()
        if not sample.empty:
            frames.append(sample)
    if not frames:
        return pd.Series(dtype=float)

    combined = pd.concat(frames, ignore_index=True)
    combined["date"] = pd.to_datetime(combined["date"], errors="coerce")
    combined["date"] = combined["date"].dt.tz_localize(None).dt.normalize()
    combined["close"] = pd.to_numeric(combined["close"], errors="coerce")
    combined = combined.dropna(subset=["date", "close"]).drop_duplicates(subset=["date"]).sort_values("date")
    return combined.set_index("date")["close"].astype(float)


def _build_asset_series_map(market_data: dict[str, pd.DataFrame]) -> dict[str, pd.Series]:
    series_map: dict[str, pd.Series] = {}
    for frame in market_data.values():
        if frame.empty:
            continue
        sample = frame.loc[:, ["date", "asset", "close"]].copy()
        sample["date"] = pd.to_datetime(sample["date"], errors="coerce")
        sample["date"] = sample["date"].dt.tz_localize(None).dt.normalize()
        sample["close"] = pd.to_numeric(sample["close"], errors="coerce")
        sample = sample.dropna(subset=["date", "asset", "close"]).sort_values(["asset", "date"])
        for asset, asset_frame in sample.groupby("asset"):
            series = asset_frame.drop_duplicates(subset=["date"], keep="last").set_index("date")["close"].astype(float)
            if asset in series_map:
                combined = pd.concat([series_map[asset], series]).sort_index()
                combined = combined[~combined.index.duplicated(keep="last")]
                series_map[asset] = combined
            else:
                series_map[asset] = series
    return series_map


def _series_momentum(series: pd.Series, lookback: int) -> float:
    if len(series) <= lookback:
        return 0.0
    latest = float(series.iloc[-1])
    previous = float(series.iloc[-lookback - 1])
    if previous == 0:
        return 0.0
    return (latest - previous) / abs(previous)


def _series_change(series: pd.Series, lookback: int) -> float:
    if len(series) <= lookback:
        return 0.0
    return float(series.iloc[-1] - series.iloc[-lookback - 1])


def _latest_value(series: pd.Series) -> float:
    if series.empty:
        return 0.0
    return float(series.iloc[-1])


def _run_short_term_backtest(
    dataset: pd.DataFrame,
    lookback: int,
    step: int,
    train_window: int,
    ridge_alpha: float,
    max_expected_move: float,
) -> dict[str, Any]:
    effective_lookback = min(lookback, max(20, min(120, len(dataset) // 2)))

    if len(dataset) < effective_lookback + 2:
        return {
            "samples": 0,
            "rmse": 0.0,
            "mae": 0.0,
            "hit_rate": 0.0,
            "last_case": None,
        }

    errors: list[float] = []
    abs_errors: list[float] = []
    hits = 0
    total = 0
    last_case: dict[str, Any] | None = None

    for end in range(effective_lookback, len(dataset), step):
        train_start = max(0, end - train_window)
        train = dataset.iloc[train_start:end].copy()
        row = dataset.iloc[end]
        if len(train) < 20:
            continue

        model = _fit_ridge_model(train, ridge_alpha)
        predicted_return = float(np.clip(_predict_ridge_row(row, model), -0.06, 0.06))
        latest_price = float(row["fx"])
        predicted_price = latest_price * float(np.exp(predicted_return))
        actual_price = float(row["target_price"])
        actual_return = float(row["target_return"])

        pct_error = (predicted_price - actual_price) / max(abs(actual_price), 1e-12)
        errors.append(float(pct_error**2))
        abs_errors.append(float(abs(pct_error)))
        if predicted_return * actual_return > 0:
            hits += 1
        total += 1
        last_case = {
            "reference_date": row.name.date().isoformat(),
            "predicted_price": float(predicted_price),
            "actual_price": float(actual_price),
            "predicted_return": float(predicted_return),
            "actual_return": float(actual_return),
        }

    return {
        "samples": total,
        "rmse": float(np.sqrt(np.mean(errors))) if errors else 0.0,
        "mae": float(np.mean(abs_errors)) if abs_errors else 0.0,
        "hit_rate": float(hits / total) if total else 0.0,
        "last_case": last_case,
    }


def _build_short_term_signal(
    dataset: pd.DataFrame,
    horizon: int,
    train_window: int,
    ridge_alpha: float,
    max_expected_move: float,
) -> dict[str, Any]:
    if dataset.empty:
        return {"feature_score": 0.0, "expected_return": 0.0, "confidence_score": 0.0, "drivers": []}

    train = dataset.iloc[max(0, len(dataset) - train_window - 1) : -1].copy()
    current = dataset.iloc[-1]
    if len(train) < max(40, min(train_window // 2, 80)):
        return {"feature_score": 0.0, "expected_return": 0.0, "confidence_score": 0.0, "drivers": []}

    model = _fit_ridge_model(train, ridge_alpha)
    scaled_row = _scaled_feature_row(current, model)
    predicted_return = _predict_ridge_row(current, model, scaled_row=scaled_row)
    predicted_return = float(np.clip(predicted_return, -max_expected_move * max(1, horizon), max_expected_move * max(1, horizon)))
    drivers = _top_driver_contributions(model, scaled_row)
    confidence_score = min(
        1.0,
        abs(predicted_return) / max(float(current.get("fx_vol21", 0.0)) / np.sqrt(252), 1e-4),
    )

    return {
        "feature_score": float(current[model["feature_names"]].abs().mean()),
        "expected_return": predicted_return,
        "confidence_score": float(confidence_score),
        "drivers": drivers,
        **{feature: float(current[feature]) for feature in model["feature_names"]},
    }


def _build_short_term_aligned_frame(
    fx_series: pd.Series,
    spy_series: pd.Series,
    aapl_series: pd.Series,
    dxy_series: pd.Series,
    vix_series: pd.Series,
    wti_series: pd.Series,
    dff_series: pd.Series,
    sofr_series: pd.Series,
    us3m_series: pd.Series,
    us5y_series: pd.Series,
    us2y_series: pd.Series,
    us10y_series: pd.Series,
) -> pd.DataFrame:
    base_index = fx_series.index
    aligned = pd.concat(
        [
            fx_series.rename("fx"),
            _align_to_base_index(spy_series, base_index).rename("spy"),
            _align_to_base_index(aapl_series, base_index).rename("aapl"),
            _align_to_base_index(dxy_series, base_index).rename("dxy"),
            _align_to_base_index(vix_series, base_index).rename("vix"),
            _align_to_base_index(wti_series, base_index).rename("wti"),
            _align_to_base_index(dff_series, base_index).rename("dff"),
            _align_to_base_index(sofr_series, base_index).rename("sofr"),
            _align_to_base_index(us3m_series, base_index).rename("us3m"),
            _align_to_base_index(us5y_series, base_index).rename("us5y"),
            _align_to_base_index(us2y_series, base_index).rename("us2y"),
            _align_to_base_index(us10y_series, base_index).rename("us10y"),
        ],
        axis=1,
    ).sort_index().ffill()

    fallback_levels = {
        "spy": 600.0,
        "aapl": 200.0,
        "dxy": 100.0,
        "vix": 20.0,
        "wti": 70.0,
        "dff": 4.0,
        "sofr": 4.0,
        "us3m": 4.0,
        "us5y": 4.0,
        "us2y": 4.0,
        "us10y": 4.2,
    }
    for column, level in fallback_levels.items():
        aligned[column] = aligned[column].ffill().bfill().fillna(level)

    return aligned.dropna(subset=["fx"])


def _build_short_term_dataset(aligned: pd.DataFrame, horizon: int) -> pd.DataFrame:
    frame = aligned.copy()
    log_fx = np.log(frame["fx"]).diff()
    log_spy = np.log(frame["spy"]).diff()
    log_aapl = np.log(frame["aapl"]).diff()
    log_dxy = np.log(frame["dxy"]).diff()
    log_vix = np.log(frame["vix"]).diff()
    log_wti = np.log(frame["wti"]).diff()

    frame["fx_r1"] = log_fx.rolling(1).sum()
    frame["fx_r3"] = log_fx.rolling(3).sum()
    frame["fx_r5"] = log_fx.rolling(5).sum()
    frame["fx_r10"] = log_fx.rolling(10).sum()
    frame["fx_gap21"] = (frame["fx"] / frame["fx"].rolling(21).mean()) - 1
    frame["fx_gap63"] = (frame["fx"] / frame["fx"].rolling(63).mean()) - 1
    frame["spy_r1"] = log_spy.rolling(1).sum()
    frame["spy_r5"] = log_spy.rolling(5).sum()
    frame["spy_r21"] = log_spy.rolling(21).sum()
    frame["aapl_r1"] = log_aapl.rolling(1).sum()
    frame["aapl_r5"] = log_aapl.rolling(5).sum()
    frame["aapl_r21"] = log_aapl.rolling(21).sum()
    frame["dxy_r1"] = log_dxy.rolling(1).sum()
    frame["dxy_r5"] = log_dxy.rolling(5).sum()
    frame["dxy_r21"] = log_dxy.rolling(21).sum()
    frame["vix_r1"] = log_vix.rolling(1).sum()
    frame["vix_r5"] = log_vix.rolling(5).sum()
    frame["vix_z21"] = _rolling_zscore(frame["vix"], 21)
    frame["wti_r1"] = log_wti.rolling(1).sum()
    frame["wti_r5"] = log_wti.rolling(5).sum()
    frame["wti_r21"] = log_wti.rolling(21).sum()
    frame["us2y_d5"] = frame["us2y"].diff(5) / 100.0
    frame["us10y_d5"] = frame["us10y"].diff(5) / 100.0
    frame["us3m_d5"] = frame["us3m"].diff(5) / 100.0
    frame["us5y_d5"] = frame["us5y"].diff(5) / 100.0
    frame["us2y_d21"] = frame["us2y"].diff(21) / 100.0
    frame["us10y_d21"] = frame["us10y"].diff(21) / 100.0
    frame["curve"] = frame["us10y"] - frame["us2y"]
    frame["curve_d5"] = frame["curve"].diff(5) / 100.0
    frame["curve_d21"] = frame["curve"].diff(21) / 100.0
    frame["curve_z21"] = _rolling_zscore(frame["curve"], 21)
    frame["fed_path_proxy"] = (
        0.55 * (frame["us2y"] - frame["dff"])
        + 0.30 * (frame["us5y"] - frame["us2y"])
        + 0.15 * (frame["us3m"] - frame["dff"])
    ) / 100.0
    frame["fed_path_d5"] = frame["fed_path_proxy"].diff(5)
    frame["funding_gap"] = (frame["sofr"] - frame["dff"]) / 100.0
    frame["funding_gap_d5"] = frame["funding_gap"].diff(5)
    frame["fx_vol10"] = log_fx.rolling(10).std() * np.sqrt(252)
    frame["fx_vol21"] = log_fx.rolling(21).std() * np.sqrt(252)
    frame["fx_vol_ratio"] = frame["fx_vol10"] / frame["fx_vol21"]
    frame["equity_spread_5"] = frame["aapl_r5"] - frame["spy_r5"]
    frame["macro_risk_mix"] = -0.45 * frame["dxy_r5"] + 0.35 * frame["wti_r5"] - 0.20 * frame["vix_r5"]
    frame["target_return"] = np.log(frame["fx"].shift(-horizon) / frame["fx"])
    frame["target_price"] = frame["fx"].shift(-horizon)
    feature_names = _feature_columns_for_horizon(horizon)
    frame = frame.replace([np.inf, -np.inf], np.nan)
    frame[feature_names] = frame[feature_names].apply(lambda column: column.clip(column.quantile(0.01), column.quantile(0.99)))
    frame = frame.dropna(subset=feature_names + ["target_return", "target_price"])
    frame.attrs["feature_names"] = feature_names
    return frame


def _fit_ridge_model(train: pd.DataFrame, ridge_alpha: float) -> dict[str, Any]:
    feature_names = list(train.attrs.get("feature_names", []))
    x = np.nan_to_num(train[feature_names].to_numpy(dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
    y = np.nan_to_num(train["target_return"].to_numpy(dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
    x = np.clip(x, -1.0, 1.0)
    y = np.clip(y, -0.25, 0.25)
    means = np.median(x, axis=0)
    mad = np.median(np.abs(x - means), axis=0)
    stds = np.where(mad < 1e-6, np.maximum(x.std(axis=0), 1e-3), 1.4826 * mad)
    x_scaled = (x - means) / stds
    x_scaled = np.clip(x_scaled, -5.0, 5.0)
    design = np.column_stack([np.ones(len(x_scaled)), x_scaled])
    weights = _decay_weights(len(x_scaled))
    weighted_design = design * weights[:, None]
    weighted_y = y * weights
    weighted_design = np.nan_to_num(weighted_design, nan=0.0, posinf=0.0, neginf=0.0)
    weighted_y = np.nan_to_num(weighted_y, nan=0.0, posinf=0.0, neginf=0.0)
    penalty = np.eye(design.shape[1]) * ridge_alpha
    penalty[0, 0] = 0.0
    with np.errstate(all="ignore"):
        gram = weighted_design.T @ weighted_design + penalty
        rhs = weighted_design.T @ weighted_y
        gram = np.nan_to_num(gram, nan=0.0, posinf=0.0, neginf=0.0)
        rhs = np.nan_to_num(rhs, nan=0.0, posinf=0.0, neginf=0.0)
        beta = np.linalg.pinv(gram) @ rhs
    beta = np.nan_to_num(beta, nan=0.0, posinf=0.0, neginf=0.0)
    return {"feature_names": feature_names, "means": means, "stds": stds, "beta": beta}


def _predict_ridge_row(row: pd.Series, model: dict[str, Any], scaled_row: np.ndarray | None = None) -> float:
    scaled = scaled_row if scaled_row is not None else _scaled_feature_row(row, model)
    design = np.concatenate([[1.0], scaled])
    return float(design @ model["beta"])


def _scaled_feature_row(row: pd.Series, model: dict[str, Any]) -> np.ndarray:
    values = np.nan_to_num(row[model["feature_names"]].to_numpy(dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
    scaled = (values - model["means"]) / model["stds"]
    return np.clip(scaled, -5.0, 5.0)


def _top_driver_contributions(model: dict[str, Any], scaled_row: np.ndarray, count: int = 4) -> list[dict[str, float | str]]:
    contributions = model["beta"][1:] * scaled_row
    ranked = sorted(
        zip(model["feature_names"], contributions, strict=False),
        key=lambda item: abs(float(item[1])),
        reverse=True,
    )[:count]
    return [
        {"feature": str(feature), "contribution": float(value)}
        for feature, value in ranked
    ]


def _feature_columns_for_horizon(horizon: int) -> list[str]:
    base_features = [
        "fx_r1",
        "fx_r3",
        "fx_r5",
        "fx_gap21",
        "spy_r1",
        "spy_r5",
        "aapl_r1",
        "aapl_r5",
        "dxy_r1",
        "dxy_r5",
        "vix_r1",
        "vix_r5",
        "wti_r1",
        "wti_r5",
        "us2y_d5",
        "us10y_d5",
        "us3m_d5",
        "us5y_d5",
        "curve",
        "curve_d5",
        "fed_path_proxy",
        "fed_path_d5",
        "funding_gap",
        "funding_gap_d5",
        "fx_vol10",
        "fx_vol21",
        "fx_vol_ratio",
        "equity_spread_5",
        "macro_risk_mix",
    ]
    if horizon >= 5:
        base_features.extend(
            [
                "fx_r10",
                "fx_gap63",
                "spy_r21",
                "aapl_r21",
                "dxy_r21",
                "vix_z21",
                "wti_r21",
                "us2y_d21",
                "us10y_d21",
                "curve_d21",
                "curve_z21",
            ]
        )
    return base_features


def _rolling_zscore(series: pd.Series, window: int) -> pd.Series:
    rolling_mean = series.rolling(window).mean()
    rolling_std = series.rolling(window).std()
    return (series - rolling_mean) / rolling_std.replace(0.0, np.nan)


def _decay_weights(length: int, halflife: int = 42) -> np.ndarray:
    if length <= 0:
        return np.array([], dtype=float)
    steps = np.arange(length - 1, -1, -1, dtype=float)
    weights = 0.5 ** (steps / max(halflife, 1))
    return weights / max(weights.mean(), 1e-12)


def _usd_orientation(target_asset: str) -> float:
    if len(target_asset) < 6:
        return 0.0
    if target_asset.startswith("USD"):
        return 1.0
    if target_asset.endswith("USD"):
        return -1.0
    return 0.0


def _align_to_base_index(series: pd.Series, base_index: pd.Index) -> pd.Series:
    if series.empty:
        return pd.Series(index=base_index, dtype=float)
    normalized = series.copy()
    normalized.index = pd.to_datetime(normalized.index).tz_localize(None).normalize()
    return normalized.reindex(base_index, method="ffill")


def _walk_forward_metrics(
    price_series: pd.Series,
    lookback: int,
    horizon: int,
    step: int,
    min_signal: float,
    max_annual_drift: float,
) -> dict[str, Any]:
    if len(price_series) < lookback + horizon + step:
        return {
            "samples": 0,
            "active_samples": 0,
            "coverage": 0.0,
            "rmse": 0.0,
            "mae": 0.0,
            "mape": 0.0,
            "direction_hit_rate": 0.0,
            "mean_abs_signal": 0.0,
        }

    values = price_series.to_numpy(dtype=float)
    squared_errors: list[float] = []
    absolute_errors: list[float] = []
    absolute_percent_errors: list[float] = []
    direction_hits = 0
    active_samples = 0
    signal_strengths: list[float] = []
    total_samples = 0

    for end in range(lookback, len(values) - horizon, step):
        sample = values[: end + 1]
        latest = float(sample[-1])
        log_returns = np.diff(np.log(sample))
        annual_drift = _estimate_annual_drift(log_returns, sample)
        annual_drift = float(np.clip(annual_drift, -max_annual_drift, max_annual_drift))
        predicted = latest * np.exp((annual_drift * horizon) / 252)
        actual = float(values[end + horizon])

        squared_errors.append(float(((predicted - actual) / actual) ** 2))
        absolute_errors.append(float(abs(predicted - actual) / abs(actual)))
        absolute_percent_errors.append(float(abs(predicted - actual) / max(abs(actual), 1e-12)))

        predicted_move = (predicted - latest) / max(abs(latest), 1e-12)
        actual_move = (actual - latest) / max(abs(latest), 1e-12)
        confidence = abs(predicted_move)
        signal_strengths.append(confidence)
        if confidence >= min_signal:
            active_samples += 1
            if predicted_move * actual_move > 0:
                direction_hits += 1
        total_samples += 1

    return {
        "samples": total_samples,
        "active_samples": active_samples,
        "coverage": float(active_samples / total_samples) if total_samples else 0.0,
        "rmse": float(np.sqrt(np.mean(squared_errors))) if squared_errors else 0.0,
        "mae": float(np.mean(absolute_errors)) if absolute_errors else 0.0,
        "mape": float(np.mean(absolute_percent_errors)) if absolute_percent_errors else 0.0,
        "direction_hit_rate": float(direction_hits / active_samples) if active_samples else 0.0,
        "mean_abs_signal": float(np.mean(signal_strengths)) if signal_strengths else 0.0,
    }


def _estimate_annual_drift(log_returns: np.ndarray, price_sample: np.ndarray) -> float:
    if log_returns.size == 0:
        return 0.0

    recent_21 = log_returns[-21:]
    recent_63 = log_returns[-63:]
    recent_126 = log_returns[-126:]
    ewma_vol = _ewma_volatility(recent_126 if recent_126.size else log_returns)
    equilibrium = float(np.mean(price_sample[-180:])) if price_sample.size >= 180 else float(np.mean(price_sample))
    deviation = (float(price_sample[-1]) - equilibrium) / max(abs(equilibrium), 1e-12)

    momentum_short = _weighted_average(recent_21) * 84
    momentum_medium = float(np.mean(recent_63)) * 42 if recent_63.size else 0.0
    momentum_long = float(np.mean(recent_126)) * 21 if recent_126.size else 0.0
    mean_reversion = -deviation * (0.35 + min(ewma_vol * 10, 0.35))
    volatility_drag = ewma_vol * np.sqrt(252) * 0.8

    return momentum_short + momentum_medium + momentum_long + mean_reversion - volatility_drag


def _ewma_volatility(log_returns: np.ndarray, lam: float = 0.94) -> float:
    if log_returns.size == 0:
        return 0.0
    variance = float(log_returns[0] ** 2)
    for value in log_returns[1:]:
        variance = lam * variance + (1 - lam) * float(value**2)
    return float(np.sqrt(max(variance, 1e-12)))


def _weighted_average(values: np.ndarray) -> float:
    if values.size == 0:
        return 0.0
    weights = np.arange(1, values.size + 1, dtype=float)
    return float(np.dot(values, weights) / weights.sum())
