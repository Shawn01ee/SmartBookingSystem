from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from xml.etree import ElementTree as ET
from typing import Any

import httpx
import pandas as pd


FRANKFURTER_BASE = "https://api.frankfurter.dev/v1"
TWELVE_DATA_BASE = "https://api.twelvedata.com"
FRED_GRAPH_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv"
TREASURY_XML_TEMPLATE = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
    "?data=daily_treasury_yield_curve&field_tdr_date_value={year}"
)
TWELVE_DATA_DEMO_KEY = "demo"
STOOQ_SYMBOLS = {
    "SPY": "spy.us",
    "AAPL": "aapl.us",
    "MSFT": "msft.us",
    "NVDA": "nvda.us",
    "AMZN": "amzn.us",
    "GOOGL": "googl.us",
    "META": "meta.us",
    "AVGO": "avgo.us",
    "TSLA": "tsla.us",
    "JPM": "jpm.us",
}
FRED_SERIES = {
    "DXY": "DTWEXBGS",
    "VIX": "VIXCLS",
    "WTI": "DCOILWTICO",
    "DFF": "DFF",
    "SOFR": "SOFR",
}
TREASURY_FIELDS = [
    ("US3M", "BC_3MONTH"),
    ("US6M", "BC_6MONTH"),
    ("US1Y", "BC_1YEAR"),
    ("US2Y", "BC_2YEAR"),
    ("US3Y", "BC_3YEAR"),
    ("US5Y", "BC_5YEAR"),
    ("US7Y", "BC_7YEAR"),
    ("US10Y", "BC_10YEAR"),
    ("US20Y", "BC_20YEAR"),
    ("US30Y", "BC_30YEAR"),
]


@dataclass
class DataSourceResult:
    name: str
    frame: pd.DataFrame


def _empty_market_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=["date", "asset", "close"])


def fetch_multi_asset_market_data(assets: dict[str, Any]) -> dict[str, pd.DataFrame]:
    with httpx.Client(timeout=20.0) as client:
        fx = _safe_market_fetch(lambda: _fetch_fx_pairs(client, assets["fx_pairs"]))
        equities = _safe_market_fetch(lambda: _fetch_equities(client, assets["equities"]))
        bonds = _safe_market_fetch(lambda: _fetch_treasury_yields(client))
        macro = _safe_market_fetch(lambda: _fetch_macro_series(client, assets.get("macro_series", [])))
    return {
        "fx": fx,
        "equities": equities,
        "bonds": bonds,
        "macro": macro,
    }


def _safe_market_fetch(fetcher: Any) -> pd.DataFrame:
    try:
        frame = fetcher()
    except Exception:
        return _empty_market_frame()
    if frame is None or frame.empty:
        return _empty_market_frame()
    return frame


def _fetch_fx_pairs(client: httpx.Client, pairs: list[dict[str, str]]) -> pd.DataFrame:
    end = datetime.now(tz=UTC).date()
    start = end - timedelta(days=760)
    frames: list[pd.DataFrame] = []
    for pair in pairs:
        response = client.get(
            f"{FRANKFURTER_BASE}/{start.isoformat()}..{end.isoformat()}",
            params={"base": pair["base"], "symbols": pair["quote"]},
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()
        rows = [
            {"date": date, "asset": pair["name"], "close": values[pair["quote"]]}
            for date, values in payload["rates"].items()
        ]
        frames.append(pd.DataFrame(rows))
    if not frames:
        return _empty_market_frame()
    return pd.concat(frames, ignore_index=True).sort_values(["asset", "date"])


def _fetch_equities(client: httpx.Client, symbols: list[str]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for symbol in symbols:
        try:
            symbol_rows = _fetch_twelve_data_equity(client, symbol)
        except Exception:
            symbol_rows = []
        if not symbol_rows:
            try:
                symbol_rows = _fetch_stooq_equity(client, symbol)
            except Exception:
                symbol_rows = []
        rows.extend(symbol_rows)
    if not rows:
        return _empty_market_frame()
    return pd.DataFrame(rows).sort_values(["asset", "date"])


def _fetch_twelve_data_equity(client: httpx.Client, symbol: str) -> list[dict[str, Any]]:
    response = client.get(
        f"{TWELVE_DATA_BASE}/time_series",
        params={
            "symbol": symbol,
            "interval": "1day",
            "outputsize": 300,
            "apikey": TWELVE_DATA_DEMO_KEY,
        },
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    values = payload.get("values", [])
    rows: list[dict[str, Any]] = []
    for item in values:
        close = pd.to_numeric(item.get("close"), errors="coerce")
        if pd.notna(close):
            rows.append(
                {
                    "date": item["datetime"],
                    "asset": symbol,
                    "close": float(close),
                }
            )
    return rows


def _fetch_stooq_equity(client: httpx.Client, symbol: str) -> list[dict[str, Any]]:
    response = client.get(
        "https://stooq.com/q/d/l/",
        params={"s": STOOQ_SYMBOLS.get(symbol, f"{symbol.lower()}.us"), "i": "d"},
        headers={"Accept": "text/csv"},
    )
    response.raise_for_status()
    rows: list[dict[str, Any]] = []
    for item in csv.DictReader(io.StringIO(response.text)):
        close = pd.to_numeric(item.get("Close"), errors="coerce")
        date = item.get("Date")
        if date and pd.notna(close):
            rows.append(
                {
                    "date": date,
                    "asset": symbol,
                    "close": float(close),
                }
            )
    return rows


def _fetch_treasury_yields(client: httpx.Client) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    current_year = datetime.now(tz=UTC).year
    years = [current_year - offset for offset in range(3)]

    for year in years:
        try:
            response = client.get(
                TREASURY_XML_TEMPLATE.format(year=year),
                headers={"Accept": "application/xml,text/xml"},
            )
            response.raise_for_status()
            root = ET.fromstring(response.text)
        except Exception:
            continue

        for entry in root.iter():
            if not entry.tag.endswith("entry"):
                continue

            values: dict[str, str] = {}
            for node in entry.iter():
                tag_name = node.tag.split("}")[-1]
                text = (node.text or "").strip()
                if text:
                    values[tag_name] = text

            date = values.get("NEW_DATE")
            if not date:
                continue
            for asset, field in TREASURY_FIELDS:
                value = pd.to_numeric(values.get(field), errors="coerce")
                if pd.notna(value):
                    rows.append({"date": date, "asset": asset, "close": float(value)})

    if not rows:
        return _empty_market_frame()

    return (
        pd.DataFrame(rows)
        .drop_duplicates(subset=["date", "asset"], keep="last")
        .sort_values(["asset", "date"])
    )


def _fetch_macro_series(client: httpx.Client, series_names: list[str]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for asset in series_names:
        fred_id = FRED_SERIES.get(asset)
        if not fred_id:
            continue

        try:
            response = client.get(
                FRED_GRAPH_BASE,
                params={"id": fred_id},
                headers={"Accept": "text/csv"},
            )
            response.raise_for_status()
        except Exception:
            continue

        for item in csv.DictReader(io.StringIO(response.text)):
            date = item.get("DATE")
            value = pd.to_numeric(item.get(fred_id), errors="coerce")
            if date and pd.notna(value):
                rows.append(
                    {
                        "date": date,
                        "asset": asset,
                        "close": float(value),
                    }
                )

    if not rows:
        return _empty_market_frame()

    return (
        pd.DataFrame(rows)
        .drop_duplicates(subset=["date", "asset"], keep="last")
        .sort_values(["asset", "date"])
    )
