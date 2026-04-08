from __future__ import annotations

import asyncio
import contextlib
import csv
import io
import json
import os
from pathlib import Path
import re
from datetime import UTC, datetime, timedelta
import math
from typing import Any
from xml.etree import ElementTree as ET

import httpx
import pandas as pd
import yaml
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from quant_pipeline.pipelines.data.nodes import fetch_multi_asset_market_data
from quant_pipeline.pipelines.signals.nodes import (
    build_alpha_vector,
    build_cross_asset_signal,
    build_forecast_backtest,
    build_forecast_package,
    build_short_term_model,
    build_return_matrix,
    construct_portfolio,
    estimate_covariance_matrix,
)


ALPHA_VANTAGE_API_KEY = "VI81F7Q8RAG62V6Q"
FRANKFURTER_BASE = "https://api.frankfurter.dev/v1"
ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query"
TWELVE_DATA_BASE = "https://api.twelvedata.com"
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "demo")
TREASURY_FEED_BASE = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
    "?data=daily_treasury_yield_curve"
)
NEWS_DOMAINS = {"reuters.com", "apnews.com", "bloomberg.com", "ft.com", "wsj.com", "cnbc.com"}
EQUITY_SYMBOLS = ["SPY", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "JPM"]
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
TREASURY_MATURITY_FIELDS = [
    ("3month", "BC_3MONTH"),
    ("6month", "BC_6MONTH"),
    ("1year", "BC_1YEAR"),
    ("2year", "BC_2YEAR"),
    ("3year", "BC_3YEAR"),
    ("5year", "BC_5YEAR"),
    ("7year", "BC_7YEAR"),
    ("10year", "BC_10YEAR"),
    ("20year", "BC_20YEAR"),
    ("30year", "BC_30YEAR"),
]
TRUSTED_SOURCES = {
    "Reuters": "reuters.com",
    "AP News": "apnews.com",
    "Associated Press": "apnews.com",
    "Bloomberg": "bloomberg.com",
    "Financial Times": "ft.com",
    "The Wall Street Journal": "wsj.com",
    "WSJ": "wsj.com",
    "CNBC": "cnbc.com",
}
GOOGLE_NEWS_BASE = "https://news.google.com/rss/search"
GOOGLE_NEWS_SOURCE_QUERY = "Reuters OR Bloomberg OR CNBC OR WSJ OR Financial Times OR AP"
WORKSPACE_ROOT = Path(__file__).resolve().parents[4]
FX_DASHBOARD_DIR = WORKSPACE_ROOT / "fx-dashboard"
PARAMETERS_PATH = WORKSPACE_ROOT / "quant-pipeline" / "conf" / "base" / "parameters.yml"
SNAPSHOT_DIR = WORKSPACE_ROOT / "quant-pipeline" / "data" / "snapshots"
QUANT_CACHE_TTL_SECONDS = 900
MARKET_CACHE_TTL_SECONDS = 90
_QUANT_CACHE: dict[str, Any] = {
    "saved_at": None,
    "key": None,
    "payload": None,
}
_QUANT_TASKS: dict[str, asyncio.Task[Any]] = {}
_MARKET_CACHE: dict[str, dict[str, Any]] = {}
_MARKET_TASKS: dict[str, asyncio.Task[Any]] = {}
_SNAPSHOT_TASKS: dict[str, asyncio.Task[Any]] = {}

app = FastAPI(title="quant-pipeline-api", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_snapshot_scheduler() -> None:
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    if _scheduler_enabled():
        app.state.snapshot_task = asyncio.create_task(_scheduled_snapshot_loop())


@app.on_event("shutdown")
async def shutdown_snapshot_scheduler() -> None:
    task = getattr(app.state, "snapshot_task", None)
    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/dashboard/")


@app.get("/api/dashboard")
async def dashboard(base: str = Query("USD"), target: str = Query("KRW")) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        fx_series, live_fx_quote = await asyncio.gather(
            fetch_fx_series(client, base, target),
            _safe_fetch(fetch_live_fx_quote(client, base, target), None),
        )

    if live_fx_quote:
        fx_series = _merge_live_fx_reference(fx_series, live_fx_quote)

    market_payload = get_cached_market_snapshot(base, target) or {
        "equities": [],
        "bonds": [],
        "news": [],
    }

    return {
        "as_of": datetime.now(tz=UTC).isoformat(),
        "fx": {
          "base": base,
          "target": target,
          "series": fx_series,
          "source": "Frankfurter",
          "live": live_fx_quote,
        },
        "equities": market_payload["equities"],
        "bonds": market_payload["bonds"],
        "news": market_payload["news"],
        "market_status": await ensure_market_refresh(base, target),
        "quant": get_cached_quant_snapshot(base, target),
        "quant_status": await ensure_quant_refresh(base, target),
    }


@app.get("/api/quant")
async def quant_snapshot(base: str = Query("USD"), target: str = Query("KRW")) -> dict[str, Any]:
    payload = get_cached_quant_snapshot(base, target)
    if payload is not None:
        return {
            "status": payload.get("status", "ready"),
            "as_of": payload.get("as_of"),
            "quant": payload,
        }

    status = await ensure_quant_refresh(base, target)
    if status == "computing":
        return {
            "status": "warming",
            "quant": _build_degraded_quant_snapshot(base, target, "Quant warm-up in progress"),
        }
    return {
        "status": status,
        "quant": None,
    }


@app.get("/api/snapshots/status")
def snapshot_status() -> dict[str, Any]:
    return {
        "now": datetime.now(tz=UTC).isoformat(),
        "scheduler": {
            "enabled": _scheduler_enabled(),
            "interval_seconds": _scheduler_interval_seconds(),
            "pairs": [
                {
                    "base": base,
                    "target": target,
                    **_snapshot_pair_status(base, target),
                }
                for base, target in _scheduler_pairs()
            ],
        },
    }


@app.post("/api/snapshots/refresh")
async def refresh_snapshots(base: str | None = Query(None), target: str | None = Query(None)) -> dict[str, Any]:
    pairs = [(base.upper(), target.upper())] if base and target else _scheduler_pairs()
    results: list[dict[str, Any]] = []

    for pair_base, pair_target in pairs:
        task_key = f"{pair_base}:{pair_target}"
        existing = _SNAPSHOT_TASKS.get(task_key)
        if existing and not existing.done():
            status = "refreshing"
        else:
            _SNAPSHOT_TASKS[task_key] = asyncio.create_task(_run_snapshot_refresh(task_key, pair_base, pair_target))
            status = "queued"
        results.append(
            {
                "base": pair_base,
                "target": pair_target,
                "status": status,
                **_snapshot_pair_status(pair_base, pair_target),
            }
        )

    return {
        "now": datetime.now(tz=UTC).isoformat(),
        "results": results,
    }


async def fetch_fx_series(client: httpx.AsyncClient, base: str, target: str) -> list[dict[str, Any]]:
    end = datetime.now(tz=UTC).date()
    start = end - timedelta(days=760)
    response = await client.get(
        f"{FRANKFURTER_BASE}/{start.isoformat()}..{end.isoformat()}",
        params={"base": base, "symbols": target},
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    return [
        {"date": date, "value": values[target]}
        for date, values in sorted(payload["rates"].items())
        if target in values
    ]


async def fetch_equities(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    quotes = await asyncio.gather(*(fetch_equity_quote(client, symbol) for symbol in EQUITY_SYMBOLS))
    return [quote for quote in quotes if quote]


async def fetch_equity_quote(client: httpx.AsyncClient, symbol: str) -> dict[str, Any] | None:
    quote = await _safe_fetch(fetch_twelve_data_quote(client, symbol), None)
    if quote:
        return quote
    quote = await _safe_fetch(fetch_stooq_quote(client, symbol), None)
    if quote:
        return quote
    return await _safe_fetch(fetch_alpha_vantage_quote(client, symbol), None)


async def fetch_bonds(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    current_year = datetime.now(tz=UTC).year
    for year in (current_year, current_year - 1):
        response = await client.get(
            TREASURY_FEED_BASE,
            params={"field_tdr_date_value": year},
            headers={"Accept": "application/xml,text/xml"},
        )
        response.raise_for_status()
        root = ET.fromstring(response.text)
        latest: dict[str, str] | None = None

        for entry in root.iter():
            if not entry.tag.endswith("entry"):
                continue
            values: dict[str, str] = {}
            for node in entry.iter():
                tag = node.tag.split("}")[-1]
                text = (node.text or "").strip()
                if text:
                    values[tag] = text
            if values.get("NEW_DATE") and values.get("BC_2YEAR") and values.get("BC_10YEAR"):
                latest = values

        if not latest:
            continue

        rows: list[dict[str, Any]] = []
        for maturity, field in TREASURY_MATURITY_FIELDS:
            value = _to_float(latest.get(field))
            if value:
                rows.append(
                    {
                        "maturity": maturity,
                        "date": latest["NEW_DATE"],
                        "yield": value,
                        "source": "US Treasury",
                    }
                )

        if rows:
            return rows

    return []


async def fetch_news(client: httpx.AsyncClient, base: str, target: str) -> list[dict[str, Any]]:
    google_news = await _safe_fetch(fetch_google_news_rss(client, base, target), [])
    if google_news:
        return google_news
    return await _safe_fetch(fetch_alpha_vantage_news(client), [])


async def fetch_live_fx_quote(client: httpx.AsyncClient, base: str, target: str) -> dict[str, Any] | None:
    response = await client.get(
        f"{TWELVE_DATA_BASE}/exchange_rate",
        params={
            "symbol": f"{base}/{target}",
            "apikey": TWELVE_DATA_API_KEY,
        },
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") == "error" or payload.get("code"):
        return None

    price = _to_float(payload.get("rate") or payload.get("close") or payload.get("price"))
    if not price:
        return None

    timestamp = _normalize_market_timestamp(
        payload.get("datetime")
        or payload.get("timestamp")
        or payload.get("time")
        or payload.get("date")
    )
    return {
        "symbol": payload.get("symbol", f"{base}/{target}"),
        "price": price,
        "date": _timestamp_to_date(timestamp) or datetime.now(tz=UTC).date().isoformat(),
        "timestamp": timestamp,
        "source": "Twelve Data",
        "mode": "live",
    }


async def fetch_twelve_data_quote(client: httpx.AsyncClient, symbol: str) -> dict[str, Any] | None:
    response = await client.get(
        f"{TWELVE_DATA_BASE}/quote",
        params={
            "symbol": symbol,
            "apikey": TWELVE_DATA_API_KEY,
        },
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") == "error" or payload.get("code"):
        return None

    price = _to_float(payload.get("close") or payload.get("price"))
    previous_close = _to_float(payload.get("previous_close") or payload.get("prev_close"))
    change = _to_float(payload.get("change"))
    if not change and price and previous_close:
        change = price - previous_close
    change_percent = _to_float(str(payload.get("percent_change") or payload.get("change_percent") or "0").replace("%", ""))
    if not change_percent and previous_close and change:
        change_percent = (change / previous_close) * 100
    if not price:
        return None

    latest_day = _normalize_market_timestamp(payload.get("datetime") or payload.get("timestamp"))
    return {
        "symbol": payload.get("symbol", symbol),
        "price": price,
        "change": change,
        "changePercent": change_percent,
        "latestDay": latest_day,
        "source": "Twelve Data",
    }


async def fetch_alpha_vantage_quote(client: httpx.AsyncClient, symbol: str) -> dict[str, Any] | None:
    response = await client.get(
        ALPHA_VANTAGE_BASE,
        params={
            "function": "GLOBAL_QUOTE",
            "symbol": symbol,
            "apikey": ALPHA_VANTAGE_API_KEY,
        },
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    if _is_alpha_vantage_limited(payload):
        return None

    quote = payload.get("Global Quote", {})
    if not quote:
        return None

    price = _to_float(quote.get("05. price"))
    if not price:
        return None

    return {
        "symbol": quote.get("01. symbol", symbol),
        "price": price,
        "change": _to_float(quote.get("09. change")),
        "changePercent": _to_float(str(quote.get("10. change percent", "0")).replace("%", "")),
        "latestDay": quote.get("07. latest trading day", ""),
        "source": "Alpha Vantage",
    }


async def fetch_stooq_quote(client: httpx.AsyncClient, symbol: str) -> dict[str, Any] | None:
    stooq_symbol = STOOQ_SYMBOLS.get(symbol, f"{symbol.lower()}.us")
    response = await client.get(
        "https://stooq.com/q/d/l/",
        params={"s": stooq_symbol, "i": "d"},
        headers={"Accept": "text/csv"},
    )
    response.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(response.text)))
    if len(rows) < 2:
        return None

    latest = rows[-1]
    previous = rows[-2]
    latest_close = _to_float(latest.get("Close"))
    previous_close = _to_float(previous.get("Close"))
    if not latest_close or not previous_close:
        return None

    change = latest_close - previous_close
    change_percent = (change / previous_close) * 100 if previous_close else 0.0
    return {
        "symbol": symbol,
        "price": latest_close,
        "change": change,
        "changePercent": change_percent,
        "latestDay": latest.get("Date", ""),
        "source": "Stooq",
    }


async def fetch_alpha_vantage_news(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    response = await client.get(
        ALPHA_VANTAGE_BASE,
        params={
            "function": "NEWS_SENTIMENT",
            "topics": "financial_markets,economy_macro,economy_monetary",
            "tickers": "SPY,MSFT,AAPL",
            "sort": "LATEST",
            "limit": "20",
            "apikey": ALPHA_VANTAGE_API_KEY,
        },
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    if _is_alpha_vantage_limited(payload):
        return []

    feed = payload.get("feed", [])
    normalized: list[dict[str, Any]] = []
    for item in feed:
        domain = str(item.get("source_domain", item.get("source", ""))).lower()
        if not any(domain.endswith(allowed) or allowed in domain for allowed in NEWS_DOMAINS):
            continue
        normalized.append(
            {
                "title": item.get("title", ""),
                "summary": item.get("summary", ""),
                "url": item.get("url", ""),
                "source": item.get("source", item.get("source_domain", "")),
                "sourceDomain": domain,
                "timePublished": item.get("time_published", ""),
                "sentiment": _to_float(item.get("overall_sentiment_score")),
            }
        )
        if len(normalized) >= 8:
            break
    return normalized


async def fetch_google_news_rss(client: httpx.AsyncClient, base: str, target: str) -> list[dict[str, Any]]:
    search_terms = " OR ".join(
        {
            "forex",
            "dollar",
            "treasury",
            "S&P 500",
            "stocks",
            base,
            target,
        }
    )
    query = f"({search_terms}) ({GOOGLE_NEWS_SOURCE_QUERY}) when:7d"
    response = await client.get(
        GOOGLE_NEWS_BASE,
        params={
            "q": query,
            "hl": "en-US",
            "gl": "US",
            "ceid": "US:en",
        },
        headers={"Accept": "application/rss+xml,application/xml,text/xml"},
    )
    response.raise_for_status()
    root = ET.fromstring(response.text)
    normalized: list[dict[str, Any]] = []

    for item in root.findall("./channel/item"):
        source = _extract_source_name(item.findtext("title", ""))
        if source not in TRUSTED_SOURCES:
            continue

        raw_title = item.findtext("title", "")
        title = raw_title[: -(len(source) + 3)] if raw_title.endswith(f" - {source}") else raw_title
        normalized.append(
            {
                "title": title.strip(),
                "summary": f"{source} headline via Google News RSS fallback.",
                "url": item.findtext("link", ""),
                "source": source,
                "sourceDomain": TRUSTED_SOURCES[source],
                "timePublished": item.findtext("pubDate", ""),
                "sentiment": 0.0,
            }
        )
        if len(normalized) >= 8:
            break

    return normalized


async def _safe_fetch(coro: Any, default: Any) -> Any:
    try:
        return await coro
    except Exception:
        return default


async def build_market_snapshot(base: str, target: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
        equities, bonds, news = await asyncio.gather(
            _safe_fetch(fetch_equities(client), []),
            _safe_fetch(fetch_bonds(client), []),
            _safe_fetch(fetch_news(client, base, target), []),
        )

    return {
        "as_of": datetime.now(tz=UTC).isoformat(),
        "equities": equities,
        "bonds": bonds,
        "news": news,
    }


def get_cached_market_snapshot(base: str, target: str) -> dict[str, Any] | None:
    cache_key = f"{base}:{target}"
    cached = _MARKET_CACHE.get(cache_key)
    if not cached:
        return None

    saved_at = cached.get("saved_at")
    if not isinstance(saved_at, datetime):
        return None

    if (datetime.now(tz=UTC) - saved_at).total_seconds() >= MARKET_CACHE_TTL_SECONDS:
        return None

    payload = cached.get("payload")
    return payload if isinstance(payload, dict) else None


async def ensure_market_refresh(base: str, target: str) -> str:
    cache_key = f"{base}:{target}"
    if get_cached_market_snapshot(base, target) is not None:
        return "ready"

    existing = _MARKET_TASKS.get(cache_key)
    if existing and not existing.done():
        return "computing"

    task = asyncio.create_task(_refresh_market_snapshot(cache_key, base, target))
    _MARKET_TASKS[cache_key] = task
    return "computing"


async def _refresh_market_snapshot(cache_key: str, base: str, target: str) -> None:
    try:
        payload = await build_market_snapshot(base, target)
        _MARKET_CACHE[cache_key] = {
            "saved_at": datetime.now(tz=UTC),
            "payload": payload,
        }
    finally:
        _MARKET_TASKS.pop(cache_key, None)


async def _scheduled_snapshot_loop() -> None:
    while True:
        await _refresh_scheduled_snapshots()
        await asyncio.sleep(_scheduler_interval_seconds())


async def _refresh_scheduled_snapshots() -> None:
    for base, target in _scheduler_pairs():
        with contextlib.suppress(Exception):
            await _capture_daily_snapshot(base, target)


async def _run_snapshot_refresh(task_key: str, base: str, target: str) -> None:
    try:
        await _capture_daily_snapshot(base, target)
    finally:
        _SNAPSHOT_TASKS.pop(task_key, None)


async def _capture_daily_snapshot(base: str, target: str) -> None:
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        fx_series, live_fx_quote = await asyncio.gather(
            _safe_fetch(fetch_fx_series(client, base, target), []),
            _safe_fetch(fetch_live_fx_quote(client, base, target), None),
        )

    if live_fx_quote:
        fx_series = _merge_live_fx_reference(fx_series, live_fx_quote)

    market_snapshot = await _safe_fetch(build_market_snapshot(base, target), {"equities": [], "bonds": [], "news": []})
    quant_snapshot = await asyncio.to_thread(_compute_quant_snapshot, base, target, False)

    payload = {
        "as_of": datetime.now(tz=UTC).isoformat(),
        "fx": {
            "base": base,
            "target": target,
            "series": fx_series,
            "source": "Frankfurter",
            "live": live_fx_quote,
        },
        "equities": market_snapshot.get("equities", []),
        "bonds": market_snapshot.get("bonds", []),
        "news": market_snapshot.get("news", []),
        "quant": quant_snapshot,
    }
    await asyncio.to_thread(_write_snapshot_files, base, target, payload)


def _write_snapshot_files(base: str, target: str, payload: dict[str, Any]) -> None:
    pair_dir = SNAPSHOT_DIR / f"{base}_{target}"
    pair_dir.mkdir(parents=True, exist_ok=True)
    latest_path = pair_dir / "latest.json"
    dated_path = pair_dir / f"{datetime.now(tz=UTC).date().isoformat()}.json"
    latest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    dated_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _snapshot_pair_status(base: str, target: str) -> dict[str, Any]:
    pair_dir = SNAPSHOT_DIR / f"{base}_{target}"
    latest_path = pair_dir / "latest.json"
    dated_files = sorted(path.name for path in pair_dir.glob("*.json") if path.name != "latest.json")
    task_key = f"{base}:{target}"

    latest_as_of = ""
    latest_market_date = ""
    latest_equity_day = ""
    if latest_path.exists():
        try:
            payload = json.loads(latest_path.read_text(encoding="utf-8"))
            latest_as_of = str(payload.get("as_of", ""))
            fx_series = payload.get("fx", {}).get("series", [])
            if isinstance(fx_series, list) and fx_series:
                latest_market_date = str(fx_series[-1].get("date", ""))
            equities = payload.get("equities", [])
            if isinstance(equities, list) and equities:
                latest_equity_day = str(equities[0].get("latestDay", ""))
        except Exception:
            pass

    return {
        "latest_path": str(latest_path),
        "latest_exists": latest_path.exists(),
        "latest_as_of": latest_as_of,
        "latest_fx_date": latest_market_date,
        "latest_equity_day": latest_equity_day,
        "dated_files": dated_files[-14:],
        "dated_count": len(dated_files),
        "refreshing": bool(_SNAPSHOT_TASKS.get(task_key) and not _SNAPSHOT_TASKS[task_key].done()),
    }


def _scheduler_enabled() -> bool:
    params = _read_parameters()
    scheduler = params.get("scheduler", {})
    return bool(scheduler.get("enabled", True))


def _scheduler_interval_seconds() -> int:
    params = _read_parameters()
    scheduler = params.get("scheduler", {})
    refresh_interval_minutes = int(scheduler.get("refresh_interval_minutes", 60))
    return max(300, refresh_interval_minutes * 60)


def _scheduler_pairs() -> list[tuple[str, str]]:
    params = _read_parameters()
    fx_pairs = params.get("assets", {}).get("fx_pairs", [])
    pairs: list[tuple[str, str]] = []
    for pair in fx_pairs:
        base = str(pair.get("base", "")).upper()
        target = str(pair.get("quote", "")).upper()
        if base and target:
            pairs.append((base, target))
    return pairs or [("USD", "KRW")]


def _normalize_market_timestamp(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return text.replace("T", " ").replace("Z", " UTC")


def _timestamp_to_date(value: str) -> str:
    if not value:
        return ""
    return value[:10]


def _merge_live_fx_reference(series: list[dict[str, Any]], live_fx_quote: dict[str, Any]) -> list[dict[str, Any]]:
    if not series:
        return series

    live_date = str(live_fx_quote.get("date", "")).strip()
    live_price = _to_float(live_fx_quote.get("price"))
    if not live_date or not live_price:
        return series

    merged = list(series)
    if merged[-1]["date"] == live_date:
        merged[-1] = {"date": live_date, "value": live_price}
        return merged
    if live_date > merged[-1]["date"]:
        merged.append({"date": live_date, "value": live_price})
    return merged


def _is_alpha_vantage_limited(payload: dict[str, Any]) -> bool:
    text = " ".join(
        str(payload.get(key, ""))
        for key in ("Information", "Note", "Error Message")
    ).lower()
    return "rate limit" in text or "thank you for using alpha vantage" in text


def _extract_source_name(title: str) -> str:
    match = re.search(r"\s-\s([^-\n]+)$", title)
    return match.group(1).strip() if match else ""


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


async def build_quant_snapshot(base: str, target: str) -> dict[str, Any]:
    cache_key = f"{base}:{target}"
    now = datetime.now(tz=UTC)
    saved_at = _QUANT_CACHE.get("saved_at")
    if (
        _QUANT_CACHE.get("payload") is not None
        and _QUANT_CACHE.get("key") == cache_key
        and isinstance(saved_at, datetime)
        and (now - saved_at).total_seconds() < QUANT_CACHE_TTL_SECONDS
    ):
        return _QUANT_CACHE["payload"]

    payload = await asyncio.to_thread(_compute_quant_snapshot, base, target, False)
    _QUANT_CACHE["saved_at"] = now
    _QUANT_CACHE["key"] = cache_key
    _QUANT_CACHE["payload"] = payload
    return payload


def _compute_quant_snapshot(base: str, target: str, include_forecast: bool = False) -> dict[str, Any]:
    params = _read_parameters()
    assets = dict(params.get("assets", {}))
    fx_pairs = [pair for pair in assets.get("fx_pairs", []) if pair.get("name") != f"{base}{target}"]
    fx_pairs.insert(0, {"name": f"{base}{target}", "base": base, "quote": target})
    assets["fx_pairs"] = fx_pairs

    market_data = fetch_multi_asset_market_data(assets)
    target_asset = f"{base}{target}"
    latest_prices = _extract_latest_prices(market_data)
    reference_price = float(latest_prices.get(target_asset, 0.0))
    issues: list[str] = []
    notes: list[str] = []

    try:
        return_matrix = build_return_matrix(market_data)
    except Exception as exc:
        return_matrix = pd.DataFrame()
        issues.append(f"return-matrix: {exc}")

    if return_matrix.empty:
        alpha_vector = pd.Series(dtype=float)
        covariance_matrix = pd.DataFrame()
        portfolio_result = _empty_portfolio_result()
        issues.append("portfolio inputs unavailable")
    else:
        try:
            alpha_vector = build_alpha_vector(return_matrix, params["portfolio"])
            covariance_matrix = estimate_covariance_matrix(return_matrix, params["portfolio"])
            if covariance_matrix.empty:
                portfolio_result = _empty_portfolio_result()
                issues.append("covariance unavailable")
            else:
                portfolio_result = construct_portfolio(alpha_vector, covariance_matrix, return_matrix, params["portfolio"])
        except Exception as exc:
            alpha_vector = pd.Series(dtype=float)
            covariance_matrix = pd.DataFrame()
            portfolio_result = _empty_portfolio_result()
            issues.append(f"portfolio: {exc}")

    if include_forecast and not return_matrix.empty:
        try:
            forecast_package = build_forecast_package(market_data, params["timesfm"])
        except Exception as exc:
            forecast_package = {"enabled": False, "forecasts": {}, "status": "degraded", "reason": str(exc)}
            issues.append(f"timesfm: {exc}")
    else:
        forecast_package = {"enabled": False, "forecasts": {}, "status": "deferred"}

    try:
        backtest_package = build_forecast_backtest(market_data, target_asset=target_asset, backtest_params=params["backtest"])
    except Exception as exc:
        backtest_package = _empty_backtest_package(target_asset, str(exc))
        issues.append(f"backtest: {exc}")

    try:
        cross_asset_signal = build_cross_asset_signal(market_data, target_asset=target_asset)
    except Exception as exc:
        cross_asset_signal = _empty_cross_asset_signal(target_asset, str(exc))
        issues.append(f"cross-asset: {exc}")

    try:
        short_term_model = build_short_term_model(market_data, target_asset=target_asset, short_term_params=params["short_term"])
    except Exception as exc:
        short_term_model = _empty_short_term_model(
            target_asset=target_asset,
            horizons=params.get("short_term", {}).get("horizons", [1, 7]),
            reference_price=reference_price,
            reason=str(exc),
        )
        issues.append(f"short-term: {exc}")

    forecast_review = _build_forecast_review(base, target, market_data)
    short_term_model = _apply_short_term_calibration(short_term_model, forecast_review, reference_price)

    if short_term_model.get("status") == "degraded":
        issues.append("short-term degraded")
    if forecast_review.get("summary", {}).get("matured_rows", 0):
        notes.append("calibrated with archived forecasts")

    top_weights = _top_items(portfolio_result["weights"], count=5)
    top_alpha = _top_items(alpha_vector.to_dict(), count=5) if not alpha_vector.empty else []
    forecast_assets = {}
    for asset_name in [target_asset, "SPY", "AAPL", "MSFT", "US10Y"]:
        forecast = forecast_package.get("forecasts", {}).get(asset_name)
        if forecast:
            forecast_assets[asset_name] = {
                "domain": forecast.get("domain"),
                "used_timesfm": bool(forecast.get("used_timesfm")),
                "message": forecast.get("message", ""),
                "next": forecast.get("forecast", [])[:5],
            }

    return {
        "as_of": datetime.now(tz=UTC).isoformat(),
        "status": "degraded" if issues else "ready",
        "issues": issues,
        "notes": notes,
        "assets": sorted(return_matrix.columns.tolist()),
        "latest_prices": latest_prices,
        "alpha": {key: round(float(value), 6) for key, value in alpha_vector.to_dict().items()},
        "covariance_assets": covariance_matrix.columns.tolist(),
        "portfolio": portfolio_result,
        "top_weights": top_weights,
        "top_alpha": top_alpha,
        "forecast": {
            "enabled": bool(forecast_package.get("enabled")),
            "status": forecast_package.get("status", "ready" if include_forecast else "deferred"),
            "assets": forecast_assets,
        },
        "backtest": backtest_package,
        "cross_asset_signal": cross_asset_signal,
        "short_term": short_term_model,
        "forecast_review": forecast_review,
    }


def get_cached_quant_snapshot(base: str, target: str) -> dict[str, Any] | None:
    cache_key = f"{base}:{target}"
    saved_at = _QUANT_CACHE.get("saved_at")
    if (
        _QUANT_CACHE.get("payload") is not None
        and _QUANT_CACHE.get("key") == cache_key
        and isinstance(saved_at, datetime)
        and (datetime.now(tz=UTC) - saved_at).total_seconds() < QUANT_CACHE_TTL_SECONDS
    ):
        return _QUANT_CACHE["payload"]
    return None


async def ensure_quant_refresh(base: str, target: str) -> str:
    cache_key = f"{base}:{target}"
    cached = get_cached_quant_snapshot(base, target)
    if cached is not None:
        return str(cached.get("status", "ready"))

    existing = _QUANT_TASKS.get(cache_key)
    if existing and not existing.done():
        return "computing"

    task = asyncio.create_task(_refresh_quant_snapshot(cache_key, base, target))
    _QUANT_TASKS[cache_key] = task
    return "computing"


async def _refresh_quant_snapshot(cache_key: str, base: str, target: str) -> None:
    try:
        payload = await asyncio.to_thread(_compute_quant_snapshot, base, target, False)
    except Exception as exc:
        payload = _build_degraded_quant_snapshot(base, target, str(exc))
    try:
        _QUANT_CACHE["saved_at"] = datetime.now(tz=UTC)
        _QUANT_CACHE["key"] = cache_key
        _QUANT_CACHE["payload"] = payload
    finally:
        _QUANT_TASKS.pop(cache_key, None)


def _build_degraded_quant_snapshot(base: str, target: str, reason: str = "") -> dict[str, Any]:
    target_asset = f"{base}{target}"
    return {
        "as_of": datetime.now(tz=UTC).isoformat(),
        "status": "degraded",
        "issues": [reason] if reason else ["quant snapshot degraded"],
        "assets": [target_asset],
        "latest_prices": {},
        "alpha": {},
        "covariance_assets": [],
        "portfolio": _empty_portfolio_result(),
        "top_weights": [],
        "top_alpha": [],
        "forecast": {"enabled": False, "status": "deferred", "assets": {}},
        "backtest": _empty_backtest_package(target_asset, reason),
        "cross_asset_signal": _empty_cross_asset_signal(target_asset, reason),
        "short_term": _empty_short_term_model(target_asset, [1, 7], 0.0, reason),
        "forecast_review": _empty_forecast_review(),
    }


def _empty_portfolio_result() -> dict[str, Any]:
    return {
        "weights": {},
        "raw_weights": {},
        "expected_shortfall": 0.0,
        "portfolio_volatility": 0.0,
        "gross_exposure": 0.0,
        "turnover_penalty": 0.0,
    }


def _empty_backtest_package(target_asset: str, reason: str = "") -> dict[str, Any]:
    return {
        "enabled": False,
        "target_asset": target_asset,
        "reason": reason or "backtest unavailable",
        "primary_horizon": 20,
        "by_horizon": {},
    }


def _empty_cross_asset_signal(target_asset: str, reason: str = "") -> dict[str, Any]:
    return {
        "target_asset": target_asset,
        "fx_momentum": 0.0,
        "spy_momentum": 0.0,
        "aapl_momentum": 0.0,
        "dxy_momentum": 0.0,
        "vix_change": 0.0,
        "wti_momentum": 0.0,
        "us2y_change": 0.0,
        "us10y_change": 0.0,
        "fed_path_proxy": 0.0,
        "curve_slope": 0.0,
        "macro_signal": 0.0,
        "composite_signal": 0.0,
        "action": "HOLD",
        "detail": reason or "Using reduced cross-asset fallback",
    }


def _empty_short_term_model(
    target_asset: str,
    horizons: list[int] | tuple[int, ...],
    reference_price: float,
    reason: str = "",
) -> dict[str, Any]:
    forecasts = {}
    backtest = {}
    for horizon in horizons:
        forecasts[str(horizon)] = {
            "expected_return": 0.0,
            "forecast_price": float(reference_price),
            "direction": "FLAT",
            "feature_score": 0.0,
            "confidence_score": 0.0,
            "drivers": [],
        }
        backtest[str(horizon)] = {
            "samples": 0,
            "rmse": 0.0,
            "mae": 0.0,
            "hit_rate": 0.0,
            "last_case": None,
        }

    return {
        "enabled": True,
        "status": "degraded",
        "target_asset": target_asset,
        "formula": "r_hat(h) = beta0 + beta'X_t, with degraded fallback because required short-horizon inputs are unavailable",
        "latest_signal": {"feature_score": 0.0, "expected_return": 0.0, "confidence_score": 0.0, "drivers": []},
        "forecasts": forecasts,
        "backtest": backtest,
        "missing_inputs": [],
        "reason": reason or "short-term inputs unavailable",
    }


def _empty_forecast_review() -> dict[str, Any]:
    return {
        "enabled": True,
        "rows": [],
        "summary": {
            "archived_snapshots": 0,
            "matured_rows": 0,
            "pending_rows": 0,
            "horizons": {},
        },
        "calibration": {},
    }


def _build_forecast_review(base: str, target: str, market_data: dict[str, pd.DataFrame]) -> dict[str, Any]:
    target_asset = f"{base}{target}"
    actual_series = _extract_fx_price_series(market_data, target_asset)
    if actual_series.empty:
        return _empty_forecast_review()

    pair_dir = SNAPSHOT_DIR / f"{base}_{target}"
    if not pair_dir.exists():
        return _empty_forecast_review()

    actual_dates = list(actual_series.index.strftime("%Y-%m-%d"))
    actual_values = actual_series.to_list()
    actual_index_map = {date: idx for idx, date in enumerate(actual_dates)}

    rows: list[dict[str, Any]] = []
    dated_paths = sorted(path for path in pair_dir.glob("*.json") if path.name != "latest.json")[-90:]
    for path in dated_paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue

        fx_series = payload.get("fx", {}).get("series", [])
        short_term = payload.get("quant", {}).get("short_term", {})
        forecasts = short_term.get("forecasts", {})
        if not isinstance(fx_series, list) or not fx_series or not isinstance(forecasts, dict):
            continue

        latest_point = fx_series[-1]
        reference_date = str(latest_point.get("date", ""))
        reference_price = _to_float(latest_point.get("value"))
        if not reference_date or not reference_price:
            continue

        reference_index = actual_index_map.get(reference_date)
        for horizon in (1, 7):
            forecast = forecasts.get(str(horizon))
            if not isinstance(forecast, dict):
                continue

            predicted_price = _to_float(forecast.get("raw_forecast_price") or forecast.get("forecast_price"))
            predicted_return = _to_float(forecast.get("raw_expected_return") or forecast.get("expected_return"))
            matured = reference_index is not None and reference_index + horizon < len(actual_dates)
            actual_price = actual_values[reference_index + horizon] if matured else 0.0
            actual_date = actual_dates[reference_index + horizon] if matured else ""
            actual_return = ((actual_price / reference_price) - 1) if matured and reference_price else 0.0
            error_pct = ((predicted_price - actual_price) / actual_price) if matured and actual_price else 0.0

            rows.append(
                {
                    "snapshot_date": path.stem,
                    "as_of": str(payload.get("as_of", "")),
                    "reference_date": reference_date,
                    "horizon": horizon,
                    "predicted_price": predicted_price,
                    "predicted_return": predicted_return,
                    "actual_date": actual_date,
                    "actual_price": actual_price if matured else None,
                    "actual_return": actual_return if matured else None,
                    "error_pct": error_pct if matured else None,
                    "abs_error_pct": abs(error_pct) if matured else None,
                    "hit": bool(predicted_return * actual_return > 0) if matured else None,
                    "matured": matured,
                }
            )

    rows.sort(key=lambda row: (row["reference_date"], row["horizon"]), reverse=True)
    summary = _summarize_forecast_review(rows)
    calibration = _derive_forecast_calibration(summary)
    return {
        "enabled": True,
        "rows": rows[:24],
        "summary": summary,
        "calibration": calibration,
    }


def _extract_fx_price_series(market_data: dict[str, pd.DataFrame], target_asset: str) -> pd.Series:
    frame = market_data.get("fx", pd.DataFrame())
    if frame.empty:
        return pd.Series(dtype=float)
    sample = frame.loc[frame["asset"] == target_asset, ["date", "close"]].copy()
    if sample.empty:
        return pd.Series(dtype=float)
    sample["date"] = pd.to_datetime(sample["date"], errors="coerce").dt.tz_localize(None).dt.normalize()
    sample["close"] = pd.to_numeric(sample["close"], errors="coerce")
    sample = sample.dropna(subset=["date", "close"]).drop_duplicates(subset=["date"], keep="last").sort_values("date")
    return sample.set_index("date")["close"].astype(float)


def _summarize_forecast_review(rows: list[dict[str, Any]]) -> dict[str, Any]:
    matured_rows = [row for row in rows if row.get("matured")]
    pending_rows = [row for row in rows if not row.get("matured")]
    horizons: dict[str, Any] = {}

    for horizon in (1, 7):
        sample = [row for row in matured_rows if row.get("horizon") == horizon]
        if not sample:
            horizons[str(horizon)] = {
                "count": 0,
                "rmse": 0.0,
                "mae": 0.0,
                "hit_rate": 0.0,
                "bias_return": 0.0,
                "avg_predicted_return": 0.0,
                "avg_actual_return": 0.0,
            }
            continue

        squared_errors = [(row["error_pct"] or 0.0) ** 2 for row in sample]
        absolute_errors = [abs(row["error_pct"] or 0.0) for row in sample]
        hits = sum(1 for row in sample if row.get("hit"))
        bias_returns = [(row["actual_return"] or 0.0) - (row["predicted_return"] or 0.0) for row in sample]
        horizons[str(horizon)] = {
            "count": len(sample),
            "rmse": math.sqrt(sum(squared_errors) / len(sample)),
            "mae": sum(absolute_errors) / len(sample),
            "hit_rate": hits / len(sample),
            "bias_return": _median(bias_returns),
            "avg_predicted_return": sum((row["predicted_return"] or 0.0) for row in sample) / len(sample),
            "avg_actual_return": sum((row["actual_return"] or 0.0) for row in sample) / len(sample),
        }

    return {
        "archived_snapshots": len({row["snapshot_date"] for row in rows}),
        "matured_rows": len(matured_rows),
        "pending_rows": len(pending_rows),
        "horizons": horizons,
    }


def _derive_forecast_calibration(summary: dict[str, Any]) -> dict[str, Any]:
    calibration: dict[str, Any] = {}
    horizons = summary.get("horizons", {})
    for horizon_key, metrics in horizons.items():
        count = int(metrics.get("count", 0))
        hit_rate = float(metrics.get("hit_rate", 0.0))
        bias_return = float(metrics.get("bias_return", 0.0))
        sample_weight = min(1.0, count / 10.0)
        shrink = _clamp(1.0 - sample_weight * max(0.0, 0.55 - hit_rate), 0.72, 1.0)
        calibration[horizon_key] = {
            "count": count,
            "sample_weight": sample_weight,
            "shrink": shrink,
            "bias_return": _clamp(bias_return * sample_weight, -0.02, 0.02),
        }
    return calibration


def _apply_short_term_calibration(short_term_model: dict[str, Any], review: dict[str, Any], reference_price: float) -> dict[str, Any]:
    if not short_term_model or not short_term_model.get("enabled"):
        return short_term_model

    calibration = review.get("calibration", {})
    forecasts = short_term_model.get("forecasts", {})
    for horizon_key, forecast in forecasts.items():
        if not isinstance(forecast, dict):
            continue
        calibration_row = calibration.get(str(horizon_key), {})
        raw_expected_return = float(forecast.get("expected_return", 0.0))
        raw_forecast_price = float(forecast.get("forecast_price", reference_price))
        shrink = float(calibration_row.get("shrink", 1.0))
        bias_return = float(calibration_row.get("bias_return", 0.0))
        adjusted_return = _clamp(raw_expected_return * shrink + bias_return, -0.08, 0.08)
        adjusted_price = reference_price * math.exp(adjusted_return) if reference_price else raw_forecast_price

        forecast["raw_expected_return"] = raw_expected_return
        forecast["raw_forecast_price"] = raw_forecast_price
        forecast["expected_return"] = adjusted_return
        forecast["forecast_price"] = adjusted_price
        forecast["direction"] = "UP" if adjusted_return > 0 else "DOWN" if adjusted_return < 0 else "FLAT"
        forecast["confidence_score"] = float(forecast.get("confidence_score", 0.0)) * shrink
        forecast["calibration_bias"] = bias_return
        forecast["shrink_factor"] = shrink
        forecast["calibrated"] = bool(calibration_row.get("count", 0) > 0)

    short_term_model["calibration"] = calibration
    short_term_model["review_summary"] = review.get("summary", {})
    return short_term_model


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return float((ordered[mid - 1] + ordered[mid]) / 2)


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _extract_latest_prices(market_data: dict[str, pd.DataFrame]) -> dict[str, float]:
    latest_prices: dict[str, float] = {}
    for frame in market_data.values():
        if frame.empty:
            continue
        sorted_frame = frame.sort_values(["asset", "date"])
        latest = sorted_frame.groupby("asset", as_index=False).tail(1)
        for _, row in latest.iterrows():
            latest_prices[str(row["asset"])] = round(float(row["close"]), 6)
    return latest_prices


def _top_items(values: dict[str, Any], count: int = 5) -> list[dict[str, Any]]:
    sorted_items = sorted(values.items(), key=lambda item: abs(float(item[1])), reverse=True)[:count]
    return [{"asset": asset, "value": round(float(value), 6)} for asset, value in sorted_items]


def _read_parameters() -> dict[str, Any]:
    with PARAMETERS_PATH.open("r", encoding="utf-8") as file:
        payload = yaml.safe_load(file) or {}
    return payload


if FX_DASHBOARD_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=FX_DASHBOARD_DIR, html=True), name="dashboard")
