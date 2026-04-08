const currencyOptions = [
  ["USD", "미국 달러"],
  ["KRW", "대한민국 원"],
  ["EUR", "유로"],
  ["JPY", "일본 엔"],
  ["CNY", "중국 위안"],
  ["GBP", "영국 파운드"],
  ["AUD", "호주 달러"],
  ["CAD", "캐나다 달러"],
  ["SGD", "싱가포르 달러"],
  ["HKD", "홍콩 달러"],
];

const factorSensitivity = {
  USD: { riskOff: 1.0, rateDiff: 0.8, commodityShock: -0.2, usdLiquidity: 1.0 },
  KRW: { riskOff: -0.9, rateDiff: -0.4, commodityShock: -0.5, usdLiquidity: -0.8 },
  EUR: { riskOff: -0.2, rateDiff: 0.2, commodityShock: -0.4, usdLiquidity: -0.2 },
  JPY: { riskOff: 0.8, rateDiff: -0.2, commodityShock: -0.1, usdLiquidity: 0.1 },
  CNY: { riskOff: -0.5, rateDiff: 0.1, commodityShock: -0.2, usdLiquidity: -0.3 },
  GBP: { riskOff: -0.3, rateDiff: 0.2, commodityShock: -0.3, usdLiquidity: -0.1 },
  AUD: { riskOff: -0.5, rateDiff: 0.1, commodityShock: 0.7, usdLiquidity: -0.2 },
  CAD: { riskOff: -0.3, rateDiff: 0.2, commodityShock: 0.5, usdLiquidity: -0.1 },
  SGD: { riskOff: -0.4, rateDiff: 0.3, commodityShock: 0.1, usdLiquidity: -0.1 },
  HKD: { riskOff: -0.1, rateDiff: 0.0, commodityShock: -0.1, usdLiquidity: 0.5 },
};

const TRADING_DAYS_YEAR = 252;
const FORECAST_BACKTEST_HORIZONS = [20, 62, 125, 251];
const AUTO_REFRESH_MS = 1000 * 60 * 5;
const FX_API_BASES = ["https://api.frankfurter.dev/v1", "https://api.frankfurter.app"];
const FX_CACHE_VERSION = "v1";
const FX_REQUEST_TIMEOUT_MS = 12000;
const DASHBOARD_REQUEST_TIMEOUT_MS = 4500;
const FX_REQUEST_RETRIES = 2;
const LOCAL_DASHBOARD_API =
  window.location.protocol === "file:"
    ? "http://127.0.0.1:8787/api/dashboard"
    : `${window.location.origin}/api/dashboard`;
const LOCAL_QUANT_API =
  window.location.protocol === "file:"
    ? "http://127.0.0.1:8787/api/quant"
    : `${window.location.origin}/api/quant`;
const ALPHA_VANTAGE_API_BASE = "https://www.alphavantage.co/query";
const ALPHA_VANTAGE_DEFAULT_KEY = "VI81F7Q8RAG62V6Q";
const TWELVE_DATA_API_BASE = "https://api.twelvedata.com";
const TWELVE_DATA_DEFAULT_KEY = "demo";
const ALPHA_VANTAGE_STORAGE_KEY = "fx-pulse:alpha-vantage-key";
const MULTI_ASSET_CACHE_KEY = "fx-pulse:v1:multi-asset";
const NEWS_CACHE_KEY = "fx-pulse:v1:news";
const TREASURY_XML_BASE = "https://home.treasury.gov/sites/default/files/interest-rates/yield.xml";
const EQUITY_SYMBOLS = ["SPY", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "JPM"];
const BOND_MATURITIES = ["3month", "6month", "1year", "2year", "3year", "5year", "7year", "10year", "20year", "30year"];
const BOND_LABELS = {
  "3month": "US 3M",
  "6month": "US 6M",
  "1year": "US 1Y",
  "2year": "US 2Y",
  "3year": "US 3Y",
  "5year": "US 5Y",
  "7year": "US 7Y",
  "10year": "US 10Y",
  "20year": "US 20Y",
  "30year": "US 30Y",
};
const TREASURY_FIELD_MAP = {
  "3month": ["d:BC_3MONTH", "BC_3MONTH"],
  "6month": ["d:BC_6MONTH", "BC_6MONTH"],
  "1year": ["d:BC_1YEAR", "BC_1YEAR"],
  "2year": ["d:BC_2YEAR", "BC_2YEAR"],
  "3year": ["d:BC_3YEAR", "BC_3YEAR"],
  "5year": ["d:BC_5YEAR", "BC_5YEAR"],
  "7year": ["d:BC_7YEAR", "BC_7YEAR"],
  "10year": ["d:BC_10YEAR", "BC_10YEAR"],
  "20year": ["d:BC_20YEAR", "BC_20YEAR"],
  "30year": ["d:BC_30YEAR", "BC_30YEAR"],
};
const TRUSTED_NEWS_DOMAINS = ["reuters.com", "apnews.com", "bloomberg.com", "ft.com", "wsj.com", "cnbc.com"];
const CURRENCY_NEWS_PROFILES = {
  USD: { keywords: ["dollar", "fed", "federal reserve", "treasury", "usd", "us economy", "us inflation"], tickers: ["DXY", "TLT", "IEF", "SHY"] },
  KRW: { keywords: ["won", "korea", "bank of korea", "krw", "south korea", "semiconductor"], tickers: ["EWY"] },
  EUR: { keywords: ["euro", "ecb", "eurozone", "eur", "germany", "france"], tickers: ["EZU"] },
  JPY: { keywords: ["yen", "boj", "bank of japan", "jpy", "japan"], tickers: ["EWJ", "FXY"] },
  CNY: { keywords: ["yuan", "renminbi", "pboc", "china", "cny"], tickers: ["MCHI", "FXI"] },
  GBP: { keywords: ["sterling", "pound", "boe", "bank of england", "uk", "britain"], tickers: ["EWU", "FXB"] },
  AUD: { keywords: ["australian dollar", "rba", "australia", "aud"], tickers: ["EWA", "FXA"] },
  CAD: { keywords: ["canadian dollar", "boc", "canada", "cad", "oil sands"], tickers: ["EWC", "FXC"] },
  SGD: { keywords: ["singapore", "sgd", "mas"], tickers: ["EWS"] },
  HKD: { keywords: ["hong kong", "hkd", "hkma"], tickers: ["EWH"] },
};
const MACRO_EVENTS_2026 = [
  {
    date: "2026-03-18",
    title: "FOMC Rate Decision",
    source: "Federal Reserve",
    tags: ["FX", "Bond", "USD"],
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  },
  {
    date: "2026-04-03",
    title: "Employment Situation (NFP)",
    source: "BLS",
    tags: ["FX", "Bond", "Equity"],
    url: "https://www.bls.gov/schedule/news_release/empsit.htm",
  },
  {
    date: "2026-04-10",
    title: "Consumer Price Index (CPI)",
    source: "BLS",
    tags: ["FX", "Bond", "Inflation"],
    url: "https://www.bls.gov/schedule/news_release/cpi.htm",
  },
  {
    date: "2026-04-29",
    title: "Advance GDP Release",
    source: "BEA",
    tags: ["FX", "Equity", "Growth"],
    url: "https://www.bea.gov/news/schedule",
  },
  {
    date: "2026-05-06",
    title: "FOMC Rate Decision",
    source: "Federal Reserve",
    tags: ["FX", "Bond", "USD"],
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  },
  {
    date: "2026-06-17",
    title: "FOMC Rate Decision",
    source: "Federal Reserve",
    tags: ["FX", "Bond", "USD"],
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  },
];
const DRIVER_LABELS = {
  fx_r1: "FX 1D momentum",
  fx_r3: "FX 3D momentum",
  fx_r5: "FX 5D momentum",
  fx_r10: "FX 10D momentum",
  fx_gap21: "21D mean-reversion gap",
  fx_gap63: "63D mean-reversion gap",
  spy_r1: "SPY 1D momentum",
  spy_r5: "SPY 5D momentum",
  spy_r21: "SPY 1M momentum",
  aapl_r1: "AAPL 1D momentum",
  aapl_r5: "AAPL 5D momentum",
  aapl_r21: "AAPL 1M momentum",
  dxy_r1: "DXY 1D move",
  dxy_r5: "DXY 5D move",
  dxy_r21: "DXY 1M move",
  vix_r1: "VIX 1D shock",
  vix_r5: "VIX 5D shock",
  vix_z21: "VIX regime z-score",
  wti_r1: "WTI 1D move",
  wti_r5: "WTI 5D move",
  wti_r21: "WTI 1M move",
  us2y_d5: "2Y rate shift",
  us10y_d5: "10Y rate shift",
  us3m_d5: "3M bill shift",
  us5y_d5: "5Y rate shift",
  curve: "Curve slope",
  curve_d5: "Curve change",
  curve_d21: "1M curve change",
  curve_z21: "Curve z-score",
  fed_path_proxy: "Fed path proxy",
  fed_path_d5: "Fed path repricing",
  funding_gap: "SOFR-DFF gap",
  funding_gap_d5: "Funding gap change",
  fx_vol10: "10D FX vol",
  fx_vol21: "21D FX vol",
  fx_vol_ratio: "Vol ratio",
  equity_spread_5: "AAPL-SPY spread",
  macro_risk_mix: "Macro risk mix",
};

const baseCurrencySelect = document.querySelector("#baseCurrency");
const targetCurrencySelect = document.querySelector("#targetCurrency");
const historyRangeSelect = document.querySelector("#historyRange");
const refreshButton = document.querySelector("#refreshButton");
const alphaVantageKeyInput = document.querySelector("#alphaVantageKey");
const saveApiKeyButton = document.querySelector("#saveApiKeyButton");

const compareAStartInput = document.querySelector("#compareAStart");
const compareAEndInput = document.querySelector("#compareAEnd");
const compareBStartInput = document.querySelector("#compareBStart");
const compareBEndInput = document.querySelector("#compareBEnd");

const riskOffInput = document.querySelector("#riskOff");
const rateDiffInput = document.querySelector("#rateDiff");
const commodityShockInput = document.querySelector("#commodityShock");
const usdLiquidityInput = document.querySelector("#usdLiquidity");

const lastUpdated = document.querySelector("#lastUpdated");
const marketNote = document.querySelector("#marketNote");
const progressStageLabel = document.querySelector("#progressStageLabel");
const progressPercentLabel = document.querySelector("#progressPercentLabel");
const progressFill = document.querySelector("#progressFill");
const progressTrack = document.querySelector(".progress-track");
const progressStepList = document.querySelector("#progressStepList");
const loaderHint = document.querySelector("#loaderHint");
const latestRate = document.querySelector("#latestRate");
const latestRateDate = document.querySelector("#latestRateDate");
const monthlyMomentum = document.querySelector("#monthlyMomentum");
const forecast3m = document.querySelector("#forecast3m");
const forecast3mBand = document.querySelector("#forecast3mBand");
const forecast6m = document.querySelector("#forecast6m");
const forecast6mBand = document.querySelector("#forecast6mBand");
const forecast12m = document.querySelector("#forecast12m");
const forecast12mBand = document.querySelector("#forecast12mBand");
const volatilityValue = document.querySelector("#volatility");
const nextSessionForecastValue = document.querySelector("#nextSessionForecast");
const nextSessionDetailValue = document.querySelector("#nextSessionDetail");
const sevenDayForecastValue = document.querySelector("#sevenDayForecast");
const sevenDayDetailValue = document.querySelector("#sevenDayDetail");
const oneDayBacktestValue = document.querySelector("#oneDayBacktest");
const oneDayBacktestDetailValue = document.querySelector("#oneDayBacktestDetail");
const sevenDayBacktestValue = document.querySelector("#sevenDayBacktest");
const sevenDayBacktestDetailValue = document.querySelector("#sevenDayBacktestDetail");

const compareAReturn = document.querySelector("#compareAReturn");
const compareALabel = document.querySelector("#compareALabel");
const compareBReturn = document.querySelector("#compareBReturn");
const compareBLabel = document.querySelector("#compareBLabel");
const compareGap = document.querySelector("#compareGap");
const compareVolatility = document.querySelector("#compareVolatility");

const factorPremiumValue = document.querySelector("#factorPremium");
const meanReversionValue = document.querySelector("#meanReversion");
const modelConfidenceValue = document.querySelector("#modelConfidence");
const regimeStateValue = document.querySelector("#regimeState");
const regimeDetailValue = document.querySelector("#regimeDetail");
const backtestRmseValue = document.querySelector("#backtestRmse");
const hitRateValue = document.querySelector("#hitRate");
const hitRateLabelValue = document.querySelector("#hitRateLabel");
const annualDriftValue = document.querySelector("#annualDrift");
const quantTopWeightValue = document.querySelector("#quantTopWeight");
const quantTopWeightDetailValue = document.querySelector("#quantTopWeightDetail");
const quantPortfolioVolValue = document.querySelector("#quantPortfolioVol");
const quantExpectedShortfallValue = document.querySelector("#quantExpectedShortfall");
const quantForecastModeValue = document.querySelector("#quantForecastMode");
const quantForecastDetailValue = document.querySelector("#quantForecastDetail");
const crossAssetSignalValue = document.querySelector("#crossAssetSignal");
const crossAssetSignalDetailValue = document.querySelector("#crossAssetSignalDetail");
const tradeActionValue = document.querySelector("#tradeAction");
const tradeActionDetailValue = document.querySelector("#tradeActionDetail");
const equitySignalValue = document.querySelector("#equitySignal");
const equitySignalDetailValue = document.querySelector("#equitySignalDetail");
const ratesSignalValue = document.querySelector("#ratesSignal");
const ratesSignalDetailValue = document.querySelector("#ratesSignalDetail");
const insightText = document.querySelector("#insightText");
const modelNote = document.querySelector("#modelNote");
const formulaText = document.querySelector("#formulaText");
const decisionSummary = document.querySelector("#decisionSummary");
const oneDayDriverList = document.querySelector("#oneDayDriverList");
const sevenDayDriverList = document.querySelector("#sevenDayDriverList");
const accuracySummary = document.querySelector("#accuracySummary");
const reviewArchiveCountValue = document.querySelector("#reviewArchiveCount");
const reviewArchiveDetailValue = document.querySelector("#reviewArchiveDetail");
const reviewOneDayAccuracyValue = document.querySelector("#reviewOneDayAccuracy");
const reviewOneDayDetailValue = document.querySelector("#reviewOneDayDetail");
const reviewSevenDayAccuracyValue = document.querySelector("#reviewSevenDayAccuracy");
const reviewSevenDayDetailValue = document.querySelector("#reviewSevenDayDetail");
const reviewCalibrationModeValue = document.querySelector("#reviewCalibrationMode");
const reviewCalibrationDetailValue = document.querySelector("#reviewCalibrationDetail");
const reviewRows = document.querySelector("#reviewRows");
const chart = document.querySelector("#chart");
const momentumChart = document.querySelector("#momentumChart");
const volatilityChart = document.querySelector("#volatilityChart");
const reversionChart = document.querySelector("#reversionChart");
const termStructureChart = document.querySelector("#termStructureChart");
const equityCards = document.querySelector("#equityCards");
const bondCards = document.querySelector("#bondCards");
const assetStatusText = document.querySelector("#assetStatusText");
const newsList = document.querySelector("#newsList");
const newsSummaryText = document.querySelector("#newsSummaryText");
const macroCalendarList = document.querySelector("#macroCalendarList");

const sliderValueMap = {
  riskOff: document.querySelector("#riskOffValue"),
  rateDiff: document.querySelector("#rateDiffValue"),
  commodityShock: document.querySelector("#commodityShockValue"),
  usdLiquidity: document.querySelector("#usdLiquidityValue"),
};

let fullSeries = [];
let dateInputsInitialized = false;
let activeRequestId = 0;
let activeAbortController = null;
let currentDataSource = "network";
let currentRefreshProgress = 0;
let latestQuantSnapshot = null;
let latestFxLiveQuote = null;
let rerenderTimer = null;
const forecastCache = new Map();

initialize();

function initialize() {
  populateSelect(baseCurrencySelect, "USD");
  populateSelect(targetCurrencySelect, "KRW");
  alphaVantageKeyInput.value = readStoredApiKey() || ALPHA_VANTAGE_DEFAULT_KEY;

  [
    baseCurrencySelect,
    targetCurrencySelect,
    historyRangeSelect,
    compareAStartInput,
    compareAEndInput,
    compareBStartInput,
    compareBEndInput,
  ].forEach((element) => element.addEventListener("change", handleParameterChange));

  [riskOffInput, rateDiffInput, commodityShockInput, usdLiquidityInput].forEach((element) => {
    element.addEventListener("input", handleScenarioInput);
  });

  refreshButton.addEventListener("click", loadDashboard);
  saveApiKeyButton.addEventListener("click", handleApiKeySave);
  document.addEventListener("visibilitychange", handleVisibilityRefresh);
  window.setInterval(loadDashboard, AUTO_REFRESH_MS);

  updateSliderLabels();
  renderEmptyAssetState("자동 데이터 소스를 연결하는 중입니다.");
  renderEmptyNewsState("자동 뉴스 소스를 연결하는 중입니다.");
  renderMacroCalendar();
  loadDashboard();
}

function populateSelect(select, defaultValue) {
  currencyOptions.forEach(([code, label]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} · ${label}`;
    option.selected = code === defaultValue;
    select.append(option);
  });
}

function scheduleRerender(delayMs = 110) {
  if (rerenderTimer) {
    window.clearTimeout(rerenderTimer);
  }

  rerenderTimer = window.setTimeout(() => {
    rerenderTimer = null;
    rerender();
  }, delayMs);
}

function handleParameterChange(event) {
  if (event.target === baseCurrencySelect || event.target === targetCurrencySelect) {
    syncCurrencySelections(event);
    return;
  }

  scheduleRerender();
}

function handleScenarioInput() {
  updateSliderLabels();
  scheduleRerender();
}

function handleApiKeySave() {
  const apiKey = alphaVantageKeyInput.value.trim();
  if (!apiKey) {
    window.localStorage.removeItem(ALPHA_VANTAGE_STORAGE_KEY);
    assetStatusText.textContent = "사용자 키를 해제했습니다. 기본 자동 데이터 소스로 전환합니다.";
  } else {
    window.localStorage.setItem(ALPHA_VANTAGE_STORAGE_KEY, apiKey);
    assetStatusText.textContent = "시장 데이터 API 키를 저장했습니다. 다음 업데이트에서 주식/채권도 함께 조회합니다.";
  }

  loadDashboard();
}

function syncCurrencySelections(event) {
  const same = baseCurrencySelect.value === targetCurrencySelect.value;
  if (!same) {
    loadDashboard();
    return;
  }

  const options = currencyOptions.map(([code]) => code);
  const fallback = options.find((code) => code !== event.target.value) || "EUR";

  if (event.target === baseCurrencySelect) {
    targetCurrencySelect.value = fallback;
  } else {
    baseCurrencySelect.value = fallback;
  }

  loadDashboard();
}

async function loadDashboard() {
  const base = baseCurrencySelect.value;
  const target = targetCurrencySelect.value;
  const requestId = ++activeRequestId;

  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();

  setLoadingState(base, target);
  setRefreshButtonState(true);

  try {
    setRefreshProgress(18, "Requesting market data", 0);
    const dashboardBundle = await fetchDashboardBundle(base, target, activeAbortController.signal);

    if (requestId !== activeRequestId) {
      return;
    }

    if (dashboardBundle) {
      setRefreshProgress(42, "Rendering snapshot", 1);
      fullSeries = dashboardBundle.fx.series;
      currentDataSource = "backend";
      latestQuantSnapshot = dashboardBundle.quant || null;
      latestFxLiveQuote = dashboardBundle.fx && dashboardBundle.fx.live ? dashboardBundle.fx.live : null;
      forecastCache.clear();
      initializeDateInputs(fullSeries);
      rerender();
      renderQuantSnapshot(dashboardBundle.quant || null);
      const backendMarketData = {
        updatedAt: dashboardBundle.as_of,
        equities: Array.isArray(dashboardBundle.equities) ? dashboardBundle.equities : [],
        bonds: Array.isArray(dashboardBundle.bonds) ? dashboardBundle.bonds : [],
        spread: calculateYieldSpread(Array.isArray(dashboardBundle.bonds) ? dashboardBundle.bonds : []),
      };
      renderAssetPanels(backendMarketData, false);
      renderNews(
        rankNewsItems(Array.isArray(dashboardBundle.news) ? dashboardBundle.news : [], base, target).slice(0, 8),
        false,
        base,
        target
      );
      setRefreshProgress(dashboardBundle.quant ? 74 : 62, dashboardBundle.quant ? "Rendering snapshot" : "Computing quant layer", dashboardBundle.quant ? 2 : 1);
      loadQuantSnapshot(requestId, activeAbortController ? activeAbortController.signal : undefined, base, target, dashboardBundle);

      if (backendMarketData.equities.length < EQUITY_SYMBOLS.length || backendMarketData.bonds.length < BOND_MATURITIES.length) {
        setRefreshProgress(84, "Refreshing side panels in background", 3);
        startSupplementaryRefresh(
          requestId,
          activeAbortController ? activeAbortController.signal : undefined,
          backendMarketData
        );
      } else {
        setRefreshProgress(100, "Primary snapshot ready", 4);
      }
    } else {
      setRefreshProgress(34, "Market snapshot unavailable, loading direct feeds", 0);
      const { series, source } = await fetchSeries(base, target, activeAbortController.signal);
      if (requestId !== activeRequestId) {
        return;
      }

      setRefreshProgress(54, "Rendering snapshot", 1);
      fullSeries = series;
      currentDataSource = source;
      latestQuantSnapshot = null;
      latestFxLiveQuote = null;
      forecastCache.clear();
      initializeDateInputs(fullSeries);
      rerender();
      renderQuantSnapshot(null);
      setRefreshProgress(84, "Refreshing side panels in background", 3);
      startSupplementaryRefresh(requestId, activeAbortController ? activeAbortController.signal : undefined);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    console.error(error);
    renderErrorState(error instanceof Error ? error.message : "알 수 없는 오류");
  } finally {
    if (requestId === activeRequestId) {
      setRefreshButtonState(false);
      activeAbortController = null;
    }
  }
}

function startSupplementaryRefresh(requestId, signal, seedMarketData = null) {
  loadSupplementaryMarkets(requestId, signal, seedMarketData)
    .then(() => {
      if (requestId === activeRequestId) {
        const quantReady = latestQuantSnapshot && ["ready", "degraded"].includes(latestQuantSnapshot.status || "ready");
        setRefreshProgress(
          quantReady ? 100 : 86,
          quantReady ? "Refresh complete" : "Primary snapshot ready",
          quantReady ? 4 : 2
        );
      }
    })
    .catch((error) => {
      console.error(error);
      if (requestId === activeRequestId) {
        const quantReady = latestQuantSnapshot && ["ready", "degraded"].includes(latestQuantSnapshot.status || "ready");
        setRefreshProgress(
          quantReady ? 100 : 86,
          quantReady ? "Refresh complete" : "Primary snapshot ready",
          quantReady ? 4 : 2
        );
      }
    });
}

async function fetchDashboardBundle(base, target, signal) {
  try {
    const response = await fetchWithTimeout(
      `${LOCAL_DASHBOARD_API}?base=${encodeURIComponent(base)}&target=${encodeURIComponent(target)}`,
      {
        signal,
        timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload || !payload.fx || !Array.isArray(payload.fx.series)) {
      return null;
    }

    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}

async function loadQuantSnapshot(requestId, signal, base, target, dashboardBundle = null) {
  if (dashboardBundle && dashboardBundle.quant) {
    latestQuantSnapshot = dashboardBundle.quant;
    renderQuantSnapshot(dashboardBundle.quant);
    if (!["warming"].includes(dashboardBundle.quant.status)) {
      setRefreshProgress(100, dashboardBundle.quant.status === "degraded" ? "Quant fallback ready" : "Refresh complete", 4);
      return;
    }
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (requestId !== activeRequestId) {
      return;
    }

    const quantPayload = await fetchQuantBundle(base, target, signal);
    if (!quantPayload) {
      break;
    }

    if (quantPayload.status === "warming" && quantPayload.quant) {
      latestQuantSnapshot = quantPayload.quant;
      if (requestId === activeRequestId) {
        rerender();
        renderQuantSnapshot(quantPayload.quant);
        setRefreshProgress(80, "Quant warm-up in progress", 2);
      }
      await delay(900, signal);
      continue;
    }

    if (["ready", "degraded"].includes(quantPayload.status) && quantPayload.quant) {
      latestQuantSnapshot = quantPayload.quant;
      if (requestId === activeRequestId) {
        rerender();
        renderQuantSnapshot(quantPayload.quant);
        setRefreshProgress(100, quantPayload.status === "degraded" ? "Quant fallback ready" : "Refresh complete", 4);
      }
      return;
    }

    if (requestId === activeRequestId) {
      const progressBase = 64 + attempt * 4;
      setRefreshProgress(Math.min(progressBase, 88), `Computing quant layer${attempt ? ` · pass ${attempt + 1}` : ""}`, 2);
    }

    await delay(900, signal);
  }

  if (requestId === activeRequestId) {
    renderQuantSnapshot(latestQuantSnapshot);
    setRefreshProgress(100, "Primary snapshot ready", 4);
  }
}

async function fetchQuantBundle(base, target, signal) {
  try {
    const response = await fetchWithTimeout(
      `${LOCAL_QUANT_API}?base=${encodeURIComponent(base)}&target=${encodeURIComponent(target)}`,
      {
        signal,
        timeoutMs: 2600,
        headers: { Accept: "application/json" },
      }
    );
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}

async function loadSupplementaryMarkets(requestId, signal, seedMarketData = null) {
  const apiKey = getEffectiveAlphaVantageKey();

  assetStatusText.textContent = "주식/채권 데이터를 업데이트하는 중입니다...";

  try {
    const marketData = await fetchMultiAssetData(apiKey, signal);
    if (requestId !== activeRequestId) {
      return;
    }
    renderAssetPanels(mergeMarketData(seedMarketData, marketData));
    await loadTrustedNews(apiKey, signal, requestId, baseCurrencySelect.value, targetCurrencySelect.value);
  } catch (error) {
    console.error(error);
    const cached = readMultiAssetCache();
    if (cached) {
      renderAssetPanels(cached, true);
    } else {
      renderEmptyAssetState(error instanceof Error ? error.message : "시장 데이터를 불러오지 못했습니다.");
    }
    await loadTrustedNews(apiKey, signal, requestId, baseCurrencySelect.value, targetCurrencySelect.value);
  }
}

async function loadTrustedNews(apiKey, signal, requestId, base, target) {
  try {
    const items = await fetchTrustedNews(apiKey, signal, base, target);
    if (requestId !== activeRequestId) {
      return;
    }
    renderNews(items, false, base, target);
  } catch (error) {
    console.error(error);
    const cached = readNewsCache();
    if (cached.length) {
      const ranked = rankNewsItems(cached, base, target);
      renderNews(ranked, true, base, target);
      return;
    }
    renderEmptyNewsState(error instanceof Error ? error.message : "뉴스를 불러오지 못했습니다.");
  }
}

function rerender() {
  if (!fullSeries.length) {
    return;
  }

  try {
    const base = baseCurrencySelect.value;
    const target = targetCurrencySelect.value;
    const displayedSeries = fullSeries.slice(-clampNumber(Number(historyRangeSelect.value), 60, fullSeries.length));
    const comparison = calculateComparison(fullSeries);
    const factors = getScenarioFactors();
    const forecast = getCachedForecast(fullSeries, factors, base, target);

    renderStats(fullSeries, forecast, target);
    renderComparison(comparison);
    renderScenarioSummary(forecast, factors, base, target);
    renderModelDiagnostics(forecast);
    renderChart(displayedSeries, forecast, base, target);
    renderAnalysisCharts(displayedSeries, forecast, target);
    renderInsight(fullSeries, forecast, comparison, base, target);
    renderDecisionSupport(forecast, latestQuantSnapshot, base, target);
  } catch (error) {
    console.error(error);
    renderErrorState(error instanceof Error ? error.message : "렌더링 오류");
  }
}

function getCachedForecast(series, factors, base, target) {
  const quantKey = latestQuantSnapshot && latestQuantSnapshot.as_of ? latestQuantSnapshot.as_of : "none";
  const lastPoint = series[series.length - 1] || { date: "na", value: 0 };
  const cacheKey = JSON.stringify({
    base,
    target,
    factors,
    seriesLength: series.length,
    lastDate: lastPoint.date,
    lastValue: Number(lastPoint.value).toFixed(6),
    quantKey,
  });

  if (forecastCache.has(cacheKey)) {
    return forecastCache.get(cacheKey);
  }

  const forecast = calculateForecast(series, factors, base, target);
  forecastCache.set(cacheKey, forecast);
  if (forecastCache.size > 24) {
    const oldestKey = forecastCache.keys().next().value;
    forecastCache.delete(oldestKey);
  }
  return forecast;
}

async function fetchMultiAssetData(apiKey, signal) {
  const [equities, bonds] = await Promise.all([fetchEquityQuotes(signal), fetchTreasuryYields(signal)]);

  const spread = calculateYieldSpread(bonds);
  const marketData = {
    updatedAt: new Date().toISOString(),
    equities,
    bonds,
    spread,
  };

  writeMultiAssetCache(marketData);
  return marketData;
}

async function fetchEquityQuotes(signal) {
  const quotes = [];

  for (let index = 0; index < EQUITY_SYMBOLS.length; index += 4) {
    const batch = EQUITY_SYMBOLS.slice(index, index + 4);
    const batchQuotes = await Promise.all(batch.map((symbol) => fetchSingleEquityQuote(symbol, signal)));
    quotes.push(...batchQuotes);
  }

  return quotes;
}

async function fetchSingleEquityQuote(symbol, signal) {
  const query = new URLSearchParams({
    symbol,
    apikey: TWELVE_DATA_DEFAULT_KEY,
  });

  const response = await fetchWithTimeout(`${TWELVE_DATA_API_BASE}/quote?${query.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`주식 데이터 요청 실패: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.code || payload.status === "error") {
    throw new Error(payload.message || `주식 데이터 오류: ${symbol}`);
  }

  const quote = parseTwelveDataQuote(payload, symbol);
  if (!quote) {
    throw new Error(`주식 데이터가 누락되었습니다: ${symbol}`);
  }
  return quote;
}

async function fetchTreasuryYields(signal) {
  const currentYear = new Date().getFullYear();
  let lastError = null;

  for (const year of [currentYear, currentYear - 1]) {
    try {
      const response = await fetchWithTimeout(`${TREASURY_XML_BASE}?field_tdr_date_value=${year}`, {
        signal,
        headers: { Accept: "application/xml,text/xml" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xmlText = await response.text();
      const bonds = parseTreasuryXml(xmlText);
      if (bonds.length >= 2) {
        return bonds;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      lastError = error;
    }
  }

  throw new Error(
    `미국채 데이터 요청 실패: ${lastError instanceof Error ? lastError.message : "unknown error"}`
  );
}

async function fetchTrustedNews(apiKey, signal, base, target) {
  const payload = await fetchAlphaVantage(
    {
      function: "NEWS_SENTIMENT",
      topics: "financial_markets,economy_macro,economy_monetary",
      tickers: "SPY,MSFT,AAPL",
      sort: "LATEST",
      limit: "20",
      apikey: apiKey,
    },
    signal
  );

  if (!payload || !Array.isArray(payload.feed)) {
    throw new Error("뉴스 데이터 응답 형식이 올바르지 않습니다.");
  }

  const items = payload.feed
    .map((item) => normalizeNewsItem(item))
    .filter(Boolean)
    .filter((item) => TRUSTED_NEWS_DOMAINS.some((domain) => item.sourceDomain.includes(domain)))
    .slice(0, 20);

  const ranked = rankNewsItems(items, base, target).slice(0, 8);

  if (!ranked.length) {
    throw new Error("신뢰 조건을 만족하는 뉴스가 아직 없습니다.");
  }

  writeNewsCache(items);
  return ranked;
}

async function fetchSeries(base, target, signal) {
  const startDate = shiftDate(new Date(), -760);
  const endDate = new Date();
  const query = new URLSearchParams({ base, symbols: target });
  const path = `${toIsoDate(startDate)}..${toIsoDate(endDate)}?${query.toString()}`;
  const cacheKey = buildCacheKey(base, target);

  try {
    const payload = await fetchJsonWithFallback(path, signal);
    const entries = parseSeriesPayload(payload, target);
    writeSeriesCache(cacheKey, entries);
    return { series: entries, source: "network" };
  } catch (error) {
    const cachedSeries = readSeriesCache(cacheKey);
    if (cachedSeries.length >= 120) {
      return { series: cachedSeries, source: "cache" };
    }
    throw error;
  }
}

function parseSeriesPayload(payload, target) {
  if (!payload || typeof payload !== "object" || !payload.rates || typeof payload.rates !== "object") {
    throw new Error("환율 API 응답 형식이 올바르지 않습니다.");
  }

  const entries = Object.entries(payload.rates)
    .map(([date, quote]) => ({ date, value: quote[target] }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((left, right) => left.date.localeCompare(right.date));

  if (entries.length < 120) {
    throw new Error("분석에 필요한 환율 데이터가 충분하지 않습니다.");
  }

  return entries;
}

async function fetchJsonWithFallback(path, signal) {
  let lastError = null;

  for (const baseUrl of FX_API_BASES) {
    for (let attempt = 0; attempt < FX_REQUEST_RETRIES; attempt += 1) {
      try {
        const response = await fetchWithTimeout(`${baseUrl}/${path}`, {
          signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        lastError = error;
      }
    }
  }

  throw new Error(
    `환율 API 요청 실패: ${lastError instanceof Error ? lastError.message : "unknown error"}`
  );
}

async function fetchAlphaVantage(params, signal) {
  const query = new URLSearchParams(params);
  let lastError = null;

  for (let attempt = 0; attempt < FX_REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${ALPHA_VANTAGE_API_BASE}?${query.toString()}`, {
        signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (payload.Note) {
        throw new Error("Alpha Vantage 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
      }
      if (payload.Information) {
        throw new Error(payload.Information);
      }
      if (payload["Error Message"]) {
        throw new Error(payload["Error Message"]);
      }

      return payload;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      lastError = error;
    }
  }

  throw new Error(
    `시장 데이터 요청 실패: ${lastError instanceof Error ? lastError.message : "unknown error"}`
  );
}

function initializeDateInputs(series) {
  const min = series[0].date;
  const max = series[series.length - 1].date;

  [compareAStartInput, compareAEndInput, compareBStartInput, compareBEndInput].forEach((input) => {
    input.min = min;
    input.max = max;
  });

  if (dateInputsInitialized) {
    clampDateInputs(series);
    return;
  }

  const aStartIndex = Math.max(0, series.length - 63);
  const aEndIndex = Math.max(0, series.length - 1);
  const bStartIndex = Math.max(0, series.length - 126);
  const bEndIndex = Math.max(0, series.length - 64);

  compareAStartInput.value = series[aStartIndex].date;
  compareAEndInput.value = series[aEndIndex].date;
  compareBStartInput.value = series[bStartIndex].date;
  compareBEndInput.value = series[bEndIndex].date;

  dateInputsInitialized = true;
}

function clampDateInputs(series) {
  const min = series[0].date;
  const max = series[series.length - 1].date;

  [compareAStartInput, compareAEndInput, compareBStartInput, compareBEndInput].forEach((input) => {
    if (!input.value || input.value < min) {
      input.value = min;
    }
    if (input.value > max) {
      input.value = max;
    }
  });
}

function calculateComparison(series) {
  const rangeA = pickRange(series, compareAStartInput.value, compareAEndInput.value);
  const rangeB = pickRange(series, compareBStartInput.value, compareBEndInput.value);

  return {
    a: summarizeRange(rangeA),
    b: summarizeRange(rangeB),
  };
}

function pickRange(series, requestedStart, requestedEnd) {
  const start = nearestIndex(series, requestedStart || series[0].date);
  const end = nearestIndex(series, requestedEnd || series[series.length - 1].date);
  const startIndex = Math.min(start, end);
  const endIndex = Math.max(start, end);
  return series.slice(startIndex, endIndex + 1);
}

function nearestIndex(series, requestedDate) {
  const target = new Date(requestedDate).getTime();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < series.length; index += 1) {
    const distance = Math.abs(new Date(series[index].date).getTime() - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function summarizeRange(range) {
  const first = range[0];
  const last = range[range.length - 1];
  const returns = toReturns(range);
  const realizedVol = standardDeviation(returns) * Math.sqrt(TRADING_DAYS_YEAR);

  return {
    startDate: first.date,
    endDate: last.date,
    mean: average(range.map((entry) => entry.value)),
    changePct: ((last.value - first.value) / first.value) * 100,
    volatility: realizedVol * 100,
    samples: range.length,
  };
}

function getScenarioFactors() {
  return {
    riskOff: clampNumber(Number(riskOffInput.value), -2, 2),
    rateDiff: clampNumber(Number(rateDiffInput.value), -2, 2),
    commodityShock: clampNumber(Number(commodityShockInput.value), -2, 2),
    usdLiquidity: clampNumber(Number(usdLiquidityInput.value), -2, 2),
  };
}

function buildSignalState(series, factorPremiumBase, crossAssetAnnual = 0) {
  const latest = series[series.length - 1];
  const returns = toReturns(series);
  const recent21 = returns.slice(-21);
  const recent60 = returns.slice(-60);
  const recent126 = returns.slice(-126);
  const trendShort = weightedAverage(recent21);
  const trendMedium = average(recent60);
  const ewmaVolDaily = calculateEwmaVolatility(recent126, 0.94);
  const annualizedVol = ewmaVolDaily * Math.sqrt(TRADING_DAYS_YEAR);
  const equilibriumWindow = series.slice(-180);
  const equilibrium = average(equilibriumWindow.map((entry) => entry.value)) || latest.value;
  const deviation = equilibrium ? (latest.value - equilibrium) / equilibrium : 0;
  const meanReversionAnnual = -deviation * 0.55;
  const regime = detectRegime(recent21, recent60, ewmaVolDaily);
  const momentumAnnual = trendShort * 84 * regime.momentumWeight + trendMedium * 42;
  const factorPremiumAnnual = factorPremiumBase * regime.factorWeight;
  const annualDriftRaw =
    momentumAnnual +
    meanReversionAnnual * regime.reversionWeight +
    factorPremiumAnnual +
    crossAssetAnnual;
  const driftCap = regime.name === "Trend" ? 0.18 : regime.name === "Balanced" ? 0.15 : 0.12;
  const annualDrift = clampNumber(annualDriftRaw, -driftCap, driftCap);
  const anchorCarryAnnual = clampNumber(
    trendMedium * 18 + factorPremiumAnnual * 0.55 + crossAssetAnnual * 0.35,
    -0.06,
    0.06
  );
  const meanReversionSpeed = clampNumber(
    0.82 +
      Math.abs(deviation) * 3.2 +
      (regime.name === "Stress" ? 0.28 : regime.name === "Balanced" ? 0.12 : 0),
    0.55,
    1.6
  );
  const driftDecay = regime.name === "Trend" ? 0.9 : regime.name === "Balanced" ? 1.2 : 1.45;

  return {
    latest,
    trendShort,
    trendMedium,
    ewmaVolDaily,
    annualizedVol,
    equilibrium,
    deviation,
    meanReversionAnnual,
    regime,
    momentumAnnual,
    factorPremiumAnnual,
    annualDrift,
    annualDriftRaw,
    anchorCarryAnnual,
    meanReversionSpeed,
    driftDecay,
  };
}

function projectExpectedValue(signalState, day) {
  const time = day / TRADING_DAYS_YEAR;
  const regimeDrag =
    signalState.regime.name === "Stress" ? 0.9 : signalState.regime.name === "Trend" ? 1.02 : 0.95;
  const driftPersistence = 0.42 + 0.58 * Math.exp(-signalState.driftDecay * time);
  const trendValue =
    signalState.latest.value *
    Math.exp(signalState.annualDrift * regimeDrag * time * driftPersistence);
  const anchorValue =
    signalState.equilibrium * Math.exp(signalState.anchorCarryAnnual * time);
  const anchorBlend = 1 - Math.exp(-signalState.meanReversionSpeed * time);

  return trendValue * (1 - anchorBlend) + anchorValue * anchorBlend;
}

function summarizeBacktestBucket(errors, absoluteErrors, observations) {
  const totalCount = observations.length;
  const hits = observations.filter((item) => item.hit).length;
  const qualified = selectQualifiedBacktestSubset(observations);

  return {
    rmse: totalCount ? Math.sqrt(average(errors)) : 0,
    mae: totalCount ? average(absoluteErrors) : 0,
    hitRate: totalCount ? hits / totalCount : 0,
    totalCount,
    samples: totalCount,
    qualifiedCount: qualified.length,
    qualifiedHitRate: qualified.length
      ? qualified.filter((item) => item.hit).length / qualified.length
      : 0,
  };
}

function interpolateBacktestMetric(horizonMetrics, day, metric, fallback) {
  const horizons = Object.keys(horizonMetrics)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (!horizons.length) {
    return fallback;
  }

  if (day <= horizons[0]) {
    return horizonMetrics[horizons[0]][metric] ?? fallback;
  }

  const lastHorizon = horizons[horizons.length - 1];
  if (day >= lastHorizon) {
    return horizonMetrics[lastHorizon][metric] ?? fallback;
  }

  for (let index = 0; index < horizons.length - 1; index += 1) {
    const left = horizons[index];
    const right = horizons[index + 1];
    if (day >= left && day <= right) {
      const weight = (day - left) / (right - left);
      const leftValue = horizonMetrics[left][metric] ?? fallback;
      const rightValue = horizonMetrics[right][metric] ?? fallback;
      return leftValue + (rightValue - leftValue) * weight;
    }
  }

  return fallback;
}

function calculateIntervalRatio(signalState, backtest, day) {
  const time = day / TRADING_DAYS_YEAR;
  const meanReversionDenominator = Math.max(2 * signalState.meanReversionSpeed, 0.0001);
  const boundedVol =
    signalState.annualizedVol *
    Math.sqrt(
      (1 - Math.exp(-2 * signalState.meanReversionSpeed * time)) / meanReversionDenominator
    );
  const shortWindowFallback = Math.max(signalState.annualizedVol * Math.sqrt(time) * 0.24, 0.0045);
  const horizonMetrics = backtest && backtest.horizons ? backtest.horizons : {};
  const rmse = interpolateBacktestMetric(horizonMetrics, day, "rmse", shortWindowFallback);
  const mae = interpolateBacktestMetric(horizonMetrics, day, "mae", shortWindowFallback * 0.82);
  const hitRate = interpolateBacktestMetric(
    horizonMetrics,
    day,
    "hitRate",
    backtest && Number.isFinite(backtest.hitRate) ? backtest.hitRate : 0.54
  );
  const confidenceScaler = clampNumber(1.06 - Math.max(0, hitRate - 0.5) * 0.26, 0.88, 1.04);
  const regimeScaler =
    signalState.regime.name === "Stress" ? 1.08 : signalState.regime.name === "Trend" ? 0.94 : 1;

  // Use walk-forward residuals as the primary interval anchor instead of letting sigma explode with sqrt(time).
  return clampNumber(
    Math.max(mae * 1.08, rmse * 0.9, boundedVol * 0.26) * confidenceScaler * regimeScaler,
    0.006,
    0.105
  );
}

function calculateForecast(series, factors, base, target) {
  const factorPremiumAnnual = deriveFactorPremium(factors, base, target);
  const crossAssetAnnual = clampNumber(
    ((latestQuantSnapshot && latestQuantSnapshot.cross_asset_signal
      ? latestQuantSnapshot.cross_asset_signal.composite_signal
      : 0) || 0) * 1.2,
    -0.12,
    0.12
  );
  const signalState = buildSignalState(series, factorPremiumAnnual, crossAssetAnnual);
  const backtest = runWalkForwardBacktest(series, factors, base, target);
  const points = buildForecastPath(signalState, backtest);
  const horizon3m = getForecastPoint(points, 62);
  const horizon6m = getForecastPoint(points, 125);
  const horizon12m = getForecastPoint(points, 251);
  const horizon3mRmse = backtest.horizons && backtest.horizons[62] ? backtest.horizons[62].rmse : backtest.rmse;
  const horizon12mRmse = backtest.horizons && backtest.horizons[251] ? backtest.horizons[251].rmse : backtest.rmse;
  const sampleStrength = Math.min(1, Math.max(0, series.length - 1) / 126);
  const confidence = Math.max(
    34,
    Math.min(
      84,
      Math.round(
        (1 - signalState.annualizedVol * 1.15 - (horizon3mRmse + horizon12mRmse) * 2.9) *
          100 *
          sampleStrength *
          (0.56 + backtest.hitRate * 0.42)
      )
    )
  );

  return {
    latest: signalState.latest,
    annualizedVol: signalState.annualizedVol,
    annualDrift: signalState.annualDrift,
    annualDriftRaw: signalState.annualDriftRaw,
    momentumAnnual: signalState.momentumAnnual,
    factorPremiumAnnual: signalState.factorPremiumAnnual,
    crossAssetAnnual,
    meanReversionAnnual: signalState.meanReversionAnnual,
    confidence,
    trendShort: signalState.trendShort,
    equilibrium: signalState.equilibrium,
    anchorCarryAnnual: signalState.anchorCarryAnnual,
    meanReversionSpeed: signalState.meanReversionSpeed,
    regime: signalState.regime,
    backtest,
    points,
    horizons: {
      m3: horizon3m,
      m6: horizon6m,
      m12: horizon12m,
    },
  };
}

function deriveFactorPremium(factors, base, target) {
  const baseWeights = factorSensitivity[base] || factorSensitivity.USD;
  const targetWeights = factorSensitivity[target] || factorSensitivity.KRW;

  const keys = Object.keys(factors);
  const rawScore = keys.reduce((total, key) => {
    return total + (baseWeights[key] - targetWeights[key]) * factors[key];
  }, 0);

  return rawScore * 0.018;
}

function buildForecastPath(signalState, backtest) {
  const points = [];

  for (let day = 1; day <= TRADING_DAYS_YEAR; day += 1) {
    const expected = projectExpectedValue(signalState, day);
    const intervalRatio = calculateIntervalRatio(signalState, backtest, day);
    const band = expected * intervalRatio;

    points.push({
      date: toIsoDate(shiftDate(new Date(signalState.latest.date), day)),
      value: expected,
      low: Math.max(0, expected - band),
      high: expected + band,
    });
  }

  return points;
}

function renderStats(series, forecast, target) {
  const latest = forecast.latest;
  const monthAgoIndex = Math.max(0, series.length - 22);
  const monthAgo = series[monthAgoIndex];
  const monthChange = ((latest.value - monthAgo.value) / monthAgo.value) * 100;
  const liveFxPrice =
    latestFxLiveQuote && Number.isFinite(Number(latestFxLiveQuote.price))
      ? Number(latestFxLiveQuote.price)
      : null;
  const liveFxTimestamp = latestFxLiveQuote && latestFxLiveQuote.timestamp ? latestFxLiveQuote.timestamp : "";

  latestRate.textContent = formatRate(liveFxPrice ?? latest.value, target);
  latestRateDate.textContent = liveFxTimestamp
    ? `Live FX quote: ${liveFxTimestamp}`
    : `Last daily FX reference: ${formatDate(latest.date)}`;
  monthlyMomentum.textContent = formatPercent(monthChange);
  forecast3m.textContent = formatRate(forecast.horizons.m3.value, target);
  forecast3mBand.textContent = bandLabel(forecast.horizons.m3, target);
  forecast6m.textContent = formatRate(forecast.horizons.m6.value, target);
  forecast6mBand.textContent = bandLabel(forecast.horizons.m6, target);
  forecast12m.textContent = formatRate(forecast.horizons.m12.value, target);
  forecast12mBand.textContent = bandLabel(forecast.horizons.m12, target);
  volatilityValue.textContent = `${(forecast.annualizedVol * 100).toFixed(2)}%`;

  lastUpdated.textContent = `${formatDate(latest.date)} reference loaded`;
  marketNote.textContent =
    currentDataSource === "cache"
      ? "Recovered the latest cached state after a network interruption."
      : liveFxTimestamp
        ? "The headline FX spot uses the latest live quote when available. Forecasts still anchor on the latest completed daily reference series."
        : "FX uses daily reference rates, while U.S. equities and Treasuries show the latest completed market session instead of the device calendar date.";
}

function renderComparison(comparison) {
  compareAReturn.textContent = formatPercent(comparison.a.changePct);
  compareALabel.textContent = `${formatShortDate(comparison.a.startDate)} - ${formatShortDate(comparison.a.endDate)}`;
  compareBReturn.textContent = formatPercent(comparison.b.changePct);
  compareBLabel.textContent = `${formatShortDate(comparison.b.startDate)} - ${formatShortDate(comparison.b.endDate)}`;
  compareGap.textContent = formatPercent(comparison.a.changePct - comparison.b.changePct);
  compareVolatility.textContent = `${comparison.a.volatility.toFixed(2)}% vs ${comparison.b.volatility.toFixed(2)}%`;
}

function renderScenarioSummary(forecast, factors, base, target) {
  factorPremiumValue.textContent = `${formatSignedNumber(forecast.factorPremiumAnnual * 100)}%`;
  meanReversionValue.textContent = `${formatSignedNumber(forecast.meanReversionAnnual * 100)}%`;
  modelConfidenceValue.textContent = `${forecast.confidence}%`;

  modelNote.textContent =
    `${base}/${target} reflects geopolitics ${factors.riskOff.toFixed(1)}, rates ${factors.rateDiff.toFixed(1)}, ` +
    `commodities ${factors.commodityShock.toFixed(1)}, dollar liquidity ${factors.usdLiquidity.toFixed(1)}, and a cross-asset overlay of ${formatSignedNumber(
      forecast.crossAssetAnnual * 100
    )}%.`;
}

function renderModelDiagnostics(forecast) {
  const horizon3m = forecast.backtest.horizons && forecast.backtest.horizons[62] ? forecast.backtest.horizons[62] : null;
  const horizon12m = forecast.backtest.horizons && forecast.backtest.horizons[251] ? forecast.backtest.horizons[251] : null;
  const labelParts = [`20D ${forecast.backtest.totalCount} windows`];

  if (horizon3m) {
    labelParts.push(`3M RMSE ${(horizon3m.rmse * 100).toFixed(2)}%`);
  }
  if (horizon12m) {
    labelParts.push(`12M RMSE ${(horizon12m.rmse * 100).toFixed(2)}%`);
  }
  if (forecast.backtest.qualifiedCount) {
    labelParts.push(`strong-signal ${(forecast.backtest.qualifiedHitRate * 100).toFixed(1)}%`);
  }

  regimeStateValue.textContent = forecast.regime.name;
  regimeDetailValue.textContent = forecast.regime.description;
  backtestRmseValue.textContent = `${forecast.backtest.rmse.toFixed(4)}`;
  hitRateValue.textContent = `${(forecast.backtest.hitRate * 100).toFixed(1)}%`;
  hitRateLabelValue.textContent = labelParts.join(" · ");
  annualDriftValue.textContent = `${formatSignedNumber(forecast.annualDrift * 100)}%`;
}

function renderQuantSnapshot(quant) {
  if (!quant || !quant.portfolio) {
    quantTopWeightValue.textContent = "-";
    quantTopWeightDetailValue.textContent = "Waiting for backend quant snapshot";
    quantPortfolioVolValue.textContent = "-";
    quantExpectedShortfallValue.textContent = "-";
    quantForecastModeValue.textContent = "-";
    quantForecastDetailValue.textContent = "No quant payload yet";
    crossAssetSignalValue.textContent = "-";
    crossAssetSignalDetailValue.textContent = "SPY · AAPL · US2Y/10Y";
    tradeActionValue.textContent = "-";
    tradeActionDetailValue.textContent = "Hold / Long / Short";
    equitySignalValue.textContent = "-";
    equitySignalDetailValue.textContent = "SPY + AAPL";
    ratesSignalValue.textContent = "-";
    ratesSignalDetailValue.textContent = "DXY + VIX + WTI";
    nextSessionForecastValue.textContent = "-";
    nextSessionDetailValue.textContent = "1-day short-horizon model";
    sevenDayForecastValue.textContent = "-";
    sevenDayDetailValue.textContent = "7-day short-horizon model";
    oneDayBacktestValue.textContent = "-";
    oneDayBacktestDetailValue.textContent = "RMSE / hit rate";
    sevenDayBacktestValue.textContent = "-";
    sevenDayBacktestDetailValue.textContent = "RMSE / hit rate";
    renderForecastReview(null);
    return;
  }

  const issues = Array.isArray(quant.issues) ? quant.issues.filter(Boolean) : [];
  const quantStatus = quant.status || "ready";
  const isDegraded = quantStatus === "degraded" || quantStatus === "warming";
  const topWeight = Array.isArray(quant.top_weights) ? quant.top_weights[0] : null;
  const portfolio = quant.portfolio || {};
  const forecastAssets = quant.forecast && quant.forecast.assets ? Object.values(quant.forecast.assets) : [];
  const usedTimesfm = forecastAssets.some((item) => item.used_timesfm);

  quantTopWeightValue.textContent = topWeight
    ? `${topWeight.asset} ${formatSignedNumber(topWeight.value * 100)}%`
    : "-";
  quantTopWeightDetailValue.textContent = topWeight
    ? `gross ${formatSignedNumber((portfolio.gross_exposure || 0) * 100)}%`
    : isDegraded
      ? "Reduced portfolio view while some feeds recover"
      : "Exposure not available yet";
  quantPortfolioVolValue.textContent = formatPercent((portfolio.portfolio_volatility || 0) * 100);
  quantExpectedShortfallValue.textContent = formatPercent((portfolio.expected_shortfall || 0) * 100);
  quantForecastModeValue.textContent =
    quantStatus === "warming" ? "Warming Up" : isDegraded ? "Reduced Mode" : usedTimesfm ? "TimesFM Live" : "Fallback";
  quantForecastDetailValue.textContent = isDegraded
    ? issues.length
      ? issues[0]
      : "Some market feeds were missing, so the engine fell back to a reduced stack."
    : forecastAssets.length
      ? `${forecastAssets.length} forecast assets linked`
      : "No forecast assets";

  const crossAsset = quant.cross_asset_signal || null;
  if (crossAsset) {
    crossAssetSignalValue.textContent = formatPercent(crossAsset.composite_signal * 100);
    crossAssetSignalDetailValue.textContent = `${crossAsset.target_asset} composite · DXY/VIX/WTI/Fed`;
    tradeActionValue.textContent = crossAsset.action;
    tradeActionDetailValue.textContent = `${crossAsset.detail} · Fed path ${formatSignedNumber((crossAsset.fed_path_proxy || 0) * 100)}bp`;
    equitySignalValue.textContent = formatPercent(
      (0.55 * (crossAsset.spy_momentum || 0) + 0.45 * (crossAsset.aapl_momentum || 0)) * 100
    );
    equitySignalDetailValue.textContent = `SPY ${formatPercent((crossAsset.spy_momentum || 0) * 100)} · AAPL ${formatPercent(
      (crossAsset.aapl_momentum || 0) * 100
    )}`;
    ratesSignalValue.textContent = formatSignedNumber((crossAsset.macro_signal || 0) * 100);
    ratesSignalDetailValue.textContent = `DXY ${formatPercent((crossAsset.dxy_momentum || 0) * 100)} · VIX ${formatSignedNumber(
      crossAsset.vix_change || 0
    )} · WTI ${formatPercent((crossAsset.wti_momentum || 0) * 100)}`;
  }

  if (quant.backtest && quant.backtest.enabled) {
    const horizon = String(quant.backtest.primary_horizon || 20);
    const metrics = quant.backtest.by_horizon && quant.backtest.by_horizon[horizon];
    if (metrics) {
      backtestRmseValue.textContent = `${(metrics.rmse * 100).toFixed(2)}%`;
      hitRateValue.textContent = `${(metrics.direction_hit_rate * 100).toFixed(1)}%`;
      hitRateLabelValue.textContent =
        `Backend WF ${horizon}d · coverage ${(metrics.coverage * 100).toFixed(1)}% · MAE ${(metrics.mae * 100).toFixed(2)}%`;
      quantForecastDetailValue.textContent =
        `WF ${horizon}d MAPE ${(metrics.mape * 100).toFixed(2)}% · ${forecastAssets.length} forecast assets`;
    }
  } else if (isDegraded && issues.length) {
    backtestRmseValue.textContent = "N/A";
    hitRateValue.textContent = "N/A";
    hitRateLabelValue.textContent = issues[0];
  }

  if (quant.short_term && quant.short_term.enabled) {
    const nextSession = quant.short_term.forecasts && quant.short_term.forecasts["1"];
    const sevenDay = quant.short_term.forecasts && quant.short_term.forecasts["7"];
    const oneDayBt = quant.short_term.backtest && quant.short_term.backtest["1"];
    const sevenDayBt = quant.short_term.backtest && quant.short_term.backtest["7"];

    if (nextSession) {
      nextSessionForecastValue.textContent = formatRate(nextSession.forecast_price, targetCurrencySelect.value);
      nextSessionDetailValue.textContent =
        `${nextSession.direction} · ${formatPercent(nextSession.expected_return * 100)} · confidence ${Math.round(
          (nextSession.confidence_score || 0) * 100
        )}%${["degraded", "warming"].includes(quant.short_term.status) ? " · reduced inputs" : ""}`;
    }

    if (sevenDay) {
      sevenDayForecastValue.textContent = formatRate(sevenDay.forecast_price, targetCurrencySelect.value);
      sevenDayDetailValue.textContent =
        `${sevenDay.direction} · ${formatPercent(sevenDay.expected_return * 100)} · confidence ${Math.round(
          (sevenDay.confidence_score || 0) * 100
        )}%${["degraded", "warming"].includes(quant.short_term.status) ? " · reduced inputs" : ""}`;
    }

    if (oneDayBt) {
      oneDayBacktestValue.textContent = `${(oneDayBt.hit_rate * 100).toFixed(1)}%`;
      oneDayBacktestDetailValue.textContent = `RMSE ${(oneDayBt.rmse * 100).toFixed(2)}% · ${oneDayBt.samples} samples`;
    }

    if (sevenDayBt) {
      sevenDayBacktestValue.textContent = `${(sevenDayBt.hit_rate * 100).toFixed(1)}%`;
      sevenDayBacktestDetailValue.textContent = `RMSE ${(sevenDayBt.rmse * 100).toFixed(2)}% · ${sevenDayBt.samples} samples`;
    }
  }

  renderForecastReview(quant);
}

function renderAssetPanels(marketData, fromCache = false) {
  const equities = Array.isArray(marketData && marketData.equities) ? marketData.equities : [];
  const bonds = Array.isArray(marketData && marketData.bonds) ? marketData.bonds : [];
  const spread = Number.isFinite(marketData && marketData.spread) ? marketData.spread : calculateYieldSpread(bonds);

  equityCards.innerHTML = equities.map(renderEquityCard).join("");
  bondCards.innerHTML = [...bonds.map(renderBondCard), renderSpreadCard(spread)].join("");
  const equitySources = [...new Set(equities.map((asset) => asset.source).filter(Boolean))];
  const bondSources = [...new Set(bonds.map((asset) => asset.source).filter(Boolean))];
  const sourceLabel = [equitySources.join("/"), bondSources.join("/")].filter(Boolean).join(" · ");

  assetStatusText.textContent = fromCache
    ? "Recovered the latest cached equity and Treasury snapshot after a network failure."
    : `Market snapshot updated on ${formatDate(marketData.updatedAt)}.${sourceLabel ? ` Sources: ${sourceLabel}` : ""} Latest dates reflect the most recently completed trading session.`;
}

function renderNews(items, fromCache = false, base, target) {
  newsList.innerHTML = items.map((item) => renderNewsCard(item)).join("");
  newsSummaryText.textContent = buildNewsSummary(items, base, target);
  if (fromCache) {
    assetStatusText.textContent = `${assetStatusText.textContent} News was restored from the latest cache.`;
  }
}

function renderChart(displayedSeries, forecast, base, target) {
  if (!displayedSeries.length || !forecast.points.length) {
    throw new Error("차트를 그릴 데이터가 없습니다.");
  }

  const width = 960;
  const height = 420;
  const padding = { top: 28, right: 30, bottom: 48, left: 76 };
  const forecastSeries = forecast.points;
  const points = [...displayedSeries, ...forecastSeries];
  const values = points.flatMap((point) => [point.low || point.value, point.high || point.value, point.value]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const xStep = (width - padding.left - padding.right) / Math.max(1, points.length - 1);
  const baselineY = height - padding.bottom;

  const scaleY = (value) => {
    const range = maxValue - minValue || 1;
    const normalized = (value - minValue) / range;
    return baselineY - normalized * (height - padding.top - padding.bottom);
  };

  const actualCoords = displayedSeries.map((entry, index) => [padding.left + xStep * index, scaleY(entry.value)]);
  const forecastCoords = forecastSeries.map((entry, index) => [
    padding.left + xStep * (displayedSeries.length + index),
    scaleY(entry.value),
  ]);
  const lowCoords = forecastSeries.map((entry, index) => [
    padding.left + xStep * (displayedSeries.length + index),
    scaleY(entry.low),
  ]);
  const highCoords = forecastSeries.map((entry, index) => [
    padding.left + xStep * (displayedSeries.length + index),
    scaleY(entry.high),
  ]);

  const actualPath = createLinePath(actualCoords);
  const actualAreaPath = createAreaPath(actualCoords, baselineY);
  const forecastStart = actualCoords[actualCoords.length - 1];
  const forecastPath = createLinePath([[forecastStart[0], forecastStart[1]], ...forecastCoords]);
  const bandPath = createBandPath(highCoords, lowCoords);
  const guides = createGuides(minValue, maxValue, scaleY, width, padding, target);
  const axisLabels = renderAxisLabels(displayedSeries, forecastSeries, padding, height, xStep);
  const dividerX = forecastStart[0];
  const latestPoint = actualCoords[actualCoords.length - 1];
  const horizonMarkers = [
    { label: "3M", point: forecast.horizons.m3 },
    { label: "6M", point: forecast.horizons.m6 },
    { label: "12M", point: forecast.horizons.m12 },
  ];

  chart.setAttribute("aria-label", `${base} 대비 ${target} 환율 추세와 12개월 예측`);
  chart.innerHTML = `
    <defs>
      <linearGradient id="actualAreaGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(141,179,255,0.32)"></stop>
        <stop offset="100%" stop-color="rgba(141,179,255,0.02)"></stop>
      </linearGradient>
      <linearGradient id="forecastBandGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(110,242,210,0.28)"></stop>
        <stop offset="100%" stop-color="rgba(110,242,210,0.04)"></stop>
      </linearGradient>
      <filter id="chartGlow">
        <feGaussianBlur stdDeviation="6" result="blur"></feGaussianBlur>
        <feMerge>
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${guides}
    <path d="${actualAreaPath}" fill="url(#actualAreaGradient)" stroke="none"></path>
    <path d="${bandPath}" fill="url(#forecastBandGradient)" stroke="none"></path>
    <line x1="${dividerX}" y1="${padding.top}" x2="${dividerX}" y2="${baselineY}" stroke="rgba(154,184,255,0.22)" stroke-dasharray="6 8"></line>
    <text x="${dividerX + 10}" y="${padding.top + 18}" fill="#94a8c8" font-size="12">Now</text>
    <path d="${actualPath}" fill="none" stroke="#8db3ff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#chartGlow)"></path>
    <path d="${forecastPath}" fill="none" stroke="#6ef2d2" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 10"></path>
    ${renderDots(actualCoords.slice(-12), "#8db3ff", 3.2)}
    ${renderDots(forecastCoords.filter((_, index) => index % 21 === 0), "#6ef2d2", 3.2)}
    <circle cx="${latestPoint[0]}" cy="${latestPoint[1]}" r="6.5" fill="#081120" stroke="#f5f8ff" stroke-width="2"></circle>
    ${renderForecastMarkers(horizonMarkers, displayedSeries.length, xStep, padding.left, scaleY, target)}
    ${axisLabels}
    <text x="${padding.left}" y="24" fill="#94a8c8" font-size="13">${base}/${target} spot and forward path</text>
  `;
}

function renderAnalysisCharts(displayedSeries, forecast, target) {
  renderMomentumChart(displayedSeries);
  renderVolatilityChart(displayedSeries);
  renderReversionChart(displayedSeries);
  renderTermStructureChart(displayedSeries, forecast, target);
}

function renderInsight(series, forecast, comparison, base, target) {
  const gapWinner = comparison.a.changePct >= comparison.b.changePct ? "구간 A" : "구간 B";
  const equilibriumGap = ((forecast.latest.value - forecast.equilibrium) / forecast.equilibrium) * 100;

  insightText.textContent =
    `${base}/${target}는 로그수익률 기준 모멘텀 ${formatSignedNumber(
      forecast.momentumAnnual * 100
    )}%, 평균회귀 ${formatSignedNumber(forecast.meanReversionAnnual * 100)}%, 팩터 프리미엄 ${formatSignedNumber(
      forecast.factorPremiumAnnual * 100
    )}%, 멀티에셋 신호 ${formatSignedNumber(forecast.crossAssetAnnual * 100)}%를 합성해 연율 기대 드리프트 ${formatSignedNumber(
      forecast.annualDrift * 100
    )}%로 계산됩니다. 현재 환율은 180거래일 평균 대비 ${formatSignedNumber(
      equilibriumGap
    )}% 괴리되어 있고, 3M/6M/12M 구간은 동일한 drift를 무한정 늘리지 않고 horizon별 백테스트 오차로 다시 좁혀 보정했습니다. 비교 분석에서는 ${gapWinner}의 성과가 더 강했습니다.`;

  formulaText.textContent =
    "mu_eff = clip(w1·mom + w2·meanReversion + w3·macro + w4·crossAsset), " +
    "forecast_t+h = (1-b_h)·S_t·exp(mu_eff·h) + b_h·S_eq,t+h, interval_h = max(backtest_MAE_h, bounded_sigma_h).";
}

function renderDecisionSupport(forecast, quant, base, target) {
  const crossAsset = quant && quant.cross_asset_signal ? quant.cross_asset_signal : null;
  const oneDay = quant && quant.short_term && quant.short_term.forecasts ? quant.short_term.forecasts["1"] : null;
  const sevenDay = quant && quant.short_term && quant.short_term.forecasts ? quant.short_term.forecasts["7"] : null;
  const oneDayBt = quant && quant.short_term && quant.short_term.backtest ? quant.short_term.backtest["1"] : null;
  const sevenDayBt = quant && quant.short_term && quant.short_term.backtest ? quant.short_term.backtest["7"] : null;
  const isDegraded = quant && ["degraded", "warming"].includes(quant.status);

  if (!quant || !crossAsset || !oneDay || !sevenDay) {
    decisionSummary.textContent =
      `${base}/${target} is currently explained with trend, mean reversion, scenario inputs, and realized volatility while the backend quant layer finishes its attribution pass.`;
    oneDayDriverList.innerHTML = renderDriverList([]);
    sevenDayDriverList.innerHTML = renderDriverList([]);
    accuracySummary.textContent = "Waiting for backend backtest diagnostics so the short-horizon view can be trusted against sample size and recent error.";
    return;
  }

  const oneDayLead = oneDay.drivers && oneDay.drivers[0] ? formatDriverContribution(oneDay.drivers[0]) : "the 1D signal mix";
  const sevenDayLead = sevenDay.drivers && sevenDay.drivers[0] ? formatDriverContribution(sevenDay.drivers[0]) : "the 7D signal mix";

  decisionSummary.textContent =
    `${base}/${target} currently leans ${oneDay.direction.toLowerCase()} on the next-session horizon because ${oneDayLead}, while the 7-day path is led by ${sevenDayLead}. ` +
    `Cross-asset confirmation is ${formatPercent((crossAsset.composite_signal || 0) * 100)} with macro pressure from DXY/VIX/WTI at ${formatPercent((crossAsset.macro_signal || 0) * 100)}.${isDegraded ? " Some drivers are running in reduced-input mode." : ""}`;
  oneDayDriverList.innerHTML = renderDriverList(oneDay.drivers || []);
  sevenDayDriverList.innerHTML = renderDriverList(sevenDay.drivers || []);
  accuracySummary.textContent =
    `1D: ${(oneDayBt && oneDayBt.hit_rate ? oneDayBt.hit_rate * 100 : 0).toFixed(1)}% hit rate over ${oneDayBt ? oneDayBt.samples : 0} samples, ` +
    `RMSE ${(oneDayBt && oneDayBt.rmse ? oneDayBt.rmse * 100 : 0).toFixed(2)}%. ` +
    `7D: ${(sevenDayBt && sevenDayBt.hit_rate ? sevenDayBt.hit_rate * 100 : 0).toFixed(1)}% hit rate over ${sevenDayBt ? sevenDayBt.samples : 0} samples, ` +
    `RMSE ${(sevenDayBt && sevenDayBt.rmse ? sevenDayBt.rmse * 100 : 0).toFixed(2)}%.`;
}

function renderForecastReview(quant) {
  const review = quant && quant.forecast_review ? quant.forecast_review : null;
  if (!review || !review.summary) {
    reviewArchiveCountValue.textContent = "-";
    reviewArchiveDetailValue.textContent = "Waiting for forecast archive";
    reviewOneDayAccuracyValue.textContent = "-";
    reviewOneDayDetailValue.textContent = "Hit rate / RMSE";
    reviewSevenDayAccuracyValue.textContent = "-";
    reviewSevenDayDetailValue.textContent = "Hit rate / RMSE";
    reviewCalibrationModeValue.textContent = "-";
    reviewCalibrationDetailValue.textContent = "Bias and shrink factors";
    reviewRows.innerHTML = '<article class="review-row review-row-empty">Waiting for archived prediction history.</article>';
    return;
  }

  const summary = review.summary || {};
  const horizons = summary.horizons || {};
  const oneDay = horizons["1"] || {};
  const sevenDay = horizons["7"] || {};
  const calibration = review.calibration || {};
  const oneDayCal = calibration["1"] || {};
  const sevenDayCal = calibration["7"] || {};

  reviewArchiveCountValue.textContent = String(summary.archived_snapshots || 0);
  reviewArchiveDetailValue.textContent = `${summary.matured_rows || 0} matured · ${summary.pending_rows || 0} pending`;
  reviewOneDayAccuracyValue.textContent = oneDay.count ? `${((oneDay.hit_rate || 0) * 100).toFixed(1)}%` : "N/A";
  reviewOneDayDetailValue.textContent = oneDay.count
    ? `RMSE ${((oneDay.rmse || 0) * 100).toFixed(2)}% · bias ${formatSignedNumber((oneDay.bias_return || 0) * 100)}%`
    : "Not enough matured 1D cases";
  reviewSevenDayAccuracyValue.textContent = sevenDay.count ? `${((sevenDay.hit_rate || 0) * 100).toFixed(1)}%` : "N/A";
  reviewSevenDayDetailValue.textContent = sevenDay.count
    ? `RMSE ${((sevenDay.rmse || 0) * 100).toFixed(2)}% · bias ${formatSignedNumber((sevenDay.bias_return || 0) * 100)}%`
    : "Not enough matured 7D cases";
  reviewCalibrationModeValue.textContent =
    oneDayCal.count || sevenDayCal.count ? "Adaptive" : "Cold Start";
  reviewCalibrationDetailValue.textContent =
    oneDayCal.count || sevenDayCal.count
      ? `1D shrink ${(oneDayCal.shrink || 1).toFixed(2)} · 7D shrink ${(sevenDayCal.shrink || 1).toFixed(2)}`
      : "Calibration will turn on once realized forecast history accumulates";

  const rows = Array.isArray(review.rows) ? review.rows.slice(0, 10) : [];
  if (!rows.length) {
    reviewRows.innerHTML = '<article class="review-row review-row-empty">No archived prediction rows available yet.</article>';
    return;
  }

  reviewRows.innerHTML = rows.map(renderForecastReviewRow).join("");
}

function renderForecastReviewRow(row) {
  const matured = Boolean(row.matured);
  const hit = row.hit === true;
  const error = Number.isFinite(Number(row.error_pct)) ? Number(row.error_pct) : null;
  const stateClass = matured ? (hit ? "is-hit" : "is-miss") : "is-pending";
  const stateLabel = matured ? (hit ? "Hit" : "Miss") : "Pending";
  const actualText = matured
    ? `${formatRate(row.actual_price, targetCurrencySelect.value)} · ${row.actual_date}`
    : "Awaiting realized session";
  const errorText = matured && error !== null ? formatPercent(error * 100) : "N/A";

  return `
    <article class="review-row ${stateClass}">
      <div class="review-row-head">
        <strong>${escapeHtml(row.reference_date)} · ${escapeHtml(String(row.horizon))}D</strong>
        <span class="review-state">${stateLabel}</span>
      </div>
      <div class="review-row-body">
        <span>Predicted ${formatRate(row.predicted_price, targetCurrencySelect.value)}</span>
        <span>Actual ${actualText}</span>
        <span>Error ${errorText}</span>
      </div>
    </article>
  `;
}

function renderDriverList(drivers) {
  if (!drivers.length) {
    return '<span class="driver-pill">Awaiting attribution</span>';
  }

  return drivers
    .map((driver) => {
      const contribution = Number(driver.contribution || 0);
      const directionClass = contribution >= 0 ? "positive" : "negative";
      return `<span class="driver-pill ${directionClass}">${escapeHtml(formatDriverLabel(driver.feature))} ${formatSignedNumber(
        contribution * 10000
      )}bp</span>`;
    })
    .join("");
}

function formatDriverContribution(driver) {
  return `${formatDriverLabel(driver.feature)} (${formatSignedNumber(Number(driver.contribution || 0) * 10000)}bp)`;
}

function formatDriverLabel(feature) {
  return DRIVER_LABELS[feature] || String(feature || "driver").replaceAll("_", " ");
}

function createGuides(minValue, maxValue, scaleY, width, padding, target) {
  const ticks = 4;
  const lines = [];

  for (let index = 0; index <= ticks; index += 1) {
    const ratio = index / ticks;
    const value = maxValue - (maxValue - minValue) * ratio;
    const y = scaleY(value);

    lines.push(
      `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(76,56,36,0.12)" stroke-dasharray="4 8"></line>`
    );
    lines.push(
      `<text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" fill="#6f6359" font-size="12">${formatShortRate(value, target)}</text>`
    );
  }

  return lines.join("");
}

function renderAxisLabels(displayedSeries, forecastSeries, padding, height, xStep) {
  const all = [...displayedSeries, ...forecastSeries];
  const indexes = [
    0,
    Math.floor(displayedSeries.length / 2),
    Math.max(0, displayedSeries.length - 1),
    displayedSeries.length + 62,
    displayedSeries.length + 125,
    all.length - 1,
  ];

  return [...new Set(indexes)]
    .filter((index) => index >= 0 && index < all.length)
    .map((index) => {
      const x = padding.left + xStep * index;
      return `<text x="${x}" y="${height - 16}" text-anchor="middle" fill="#6f6359" font-size="12">${formatAxisDate(
        all[index].date
      )}</text>`;
    })
    .join("");
}

function createLinePath(coords) {
  return coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

function createAreaPath(coords, baselineY) {
  if (!coords.length) {
    return "";
  }
  const upper = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  return `${upper} L ${coords[coords.length - 1][0].toFixed(2)} ${baselineY.toFixed(2)} L ${coords[0][0].toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

function createBandPath(highCoords, lowCoords) {
  const upper = highCoords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const lower = [...lowCoords]
    .reverse()
    .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  return `${upper} ${lower} Z`;
}

function renderDots(coords, color, radius) {
  return coords
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}"></circle>`)
    .join("");
}

function renderForecastMarkers(markers, historyLength, xStep, xOffset, scaleY, target) {
  return markers
    .filter((item) => item.point && Number.isFinite(item.point.value))
    .map((item, index) => {
      const pointIndex = historyLength + (index === 0 ? 62 : index === 1 ? 125 : 251);
      const x = xOffset + xStep * pointIndex;
      const y = scaleY(item.point.value);
      return `
        <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="5" fill="#6ef2d2" stroke="#081120" stroke-width="2"></circle>
        <rect x="${(x - 32).toFixed(2)}" y="${(y - 36).toFixed(2)}" width="64" height="20" rx="10" fill="rgba(8,17,32,0.92)" stroke="rgba(110,242,210,0.28)"></rect>
        <text x="${x.toFixed(2)}" y="${(y - 22).toFixed(2)}" text-anchor="middle" fill="#d8fff5" font-size="11">${item.label} ${formatShortRate(item.point.value, target)}</text>
      `;
    })
    .join("");
}

function renderMomentumChart(displayedSeries) {
  const points = displayedSeries.map((entry, index) => ({
    date: entry.date,
    short: index >= 21 ? Math.log(entry.value / displayedSeries[index - 21].value) * 100 : null,
    medium: index >= 60 ? Math.log(entry.value / displayedSeries[index - 60].value) * 100 : null,
  }));

  renderMiniLineChart(momentumChart, {
    title: "Momentum",
    yFormatter: (value) => `${value.toFixed(1)}%`,
    series: [
      { key: "short", label: "21D", color: "#8db3ff" },
      { key: "medium", label: "60D", color: "#6ef2d2" },
    ],
    points,
    zeroLine: true,
  });
}

function renderVolatilityChart(displayedSeries) {
  const returns = toReturns(displayedSeries);
  const points = displayedSeries.map((entry, index) => {
    if (index < 22) {
      return { date: entry.date, value: null };
    }
    const sample = returns.slice(Math.max(0, index - 21), index);
    return {
      date: entry.date,
      value: standardDeviation(sample) * Math.sqrt(TRADING_DAYS_YEAR) * 100,
    };
  });

  renderMiniLineChart(volatilityChart, {
    title: "Volatility",
    yFormatter: (value) => `${value.toFixed(1)}%`,
    series: [{ key: "value", label: "21D vol", color: "#ffb17d" }],
    points,
  });
}

function renderReversionChart(displayedSeries) {
  const points = displayedSeries.map((entry, index) => {
    const window = displayedSeries.slice(Math.max(0, index - 179), index + 1);
    const equilibrium = average(window.map((item) => item.value));
    return {
      date: entry.date,
      value: equilibrium ? ((entry.value / equilibrium) - 1) * 100 : 0,
    };
  });

  renderMiniLineChart(reversionChart, {
    title: "Mean Reversion Gap",
    yFormatter: (value) => `${value.toFixed(1)}%`,
    series: [{ key: "value", label: "Gap vs 180D mean", color: "#9f8bff" }],
    points,
    zeroLine: true,
    areaFill: "rgba(159,139,255,0.16)",
  });
}

function renderTermStructureChart(displayedSeries, forecast, target) {
  const latest = displayedSeries[displayedSeries.length - 1];
  const quant = latestQuantSnapshot && latestQuantSnapshot.short_term ? latestQuantSnapshot.short_term : null;
  const horizons = [
    {
      label: "1D",
      value:
        quant && quant.forecasts && quant.forecasts["1"]
          ? ((quant.forecasts["1"].forecast_price / latest.value) - 1) * 100
          : 0,
    },
    {
      label: "7D",
      value:
        quant && quant.forecasts && quant.forecasts["7"]
          ? ((quant.forecasts["7"].forecast_price / latest.value) - 1) * 100
          : 0,
    },
    { label: "3M", value: ((forecast.horizons.m3.value / latest.value) - 1) * 100 },
    { label: "6M", value: ((forecast.horizons.m6.value / latest.value) - 1) * 100 },
    { label: "12M", value: ((forecast.horizons.m12.value / latest.value) - 1) * 100 },
  ];

  renderBarChart(termStructureChart, horizons, target);
}

function renderMiniLineChart(svg, config) {
  const width = 520;
  const height = 220;
  const padding = { top: 22, right: 18, bottom: 34, left: 54 };
  const valueSeries = config.series.flatMap((line) =>
    config.points.map((point) => point[line.key]).filter((value) => Number.isFinite(value))
  );

  if (!valueSeries.length) {
    svg.innerHTML = buildSvgPlaceholder(width, height, "Waiting for chart data");
    return;
  }

  const minValue = Math.min(...valueSeries, config.zeroLine ? 0 : Number.POSITIVE_INFINITY);
  const maxValue = Math.max(...valueSeries, config.zeroLine ? 0 : Number.NEGATIVE_INFINITY);
  const xStep = (width - padding.left - padding.right) / Math.max(1, config.points.length - 1);
  const scaleY = (value) => {
    const range = maxValue - minValue || 1;
    return height - padding.bottom - ((value - minValue) / range) * (height - padding.top - padding.bottom);
  };

  const guideValues = [minValue, (minValue + maxValue) / 2, maxValue];
  const guides = guideValues
    .map((value) => {
      const y = scaleY(value);
      return `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(154,184,255,0.12)" stroke-dasharray="4 8"></line>
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="#94a8c8" font-size="11">${config.yFormatter(value)}</text>
      `;
    })
    .join("");

  const zeroLine =
    config.zeroLine && minValue < 0 && maxValue > 0
      ? `<line x1="${padding.left}" y1="${scaleY(0)}" x2="${width - padding.right}" y2="${scaleY(0)}" stroke="rgba(255,255,255,0.18)" stroke-dasharray="5 7"></line>`
      : "";

  const seriesMarkup = config.series
    .map((line) => {
      const coords = config.points
        .map((point, index) =>
          Number.isFinite(point[line.key]) ? [padding.left + xStep * index, scaleY(point[line.key])] : null
        )
        .filter(Boolean);
      const path = createLinePath(coords);
      const area =
        config.areaFill && coords.length
          ? `<path d="${createAreaPath(coords, height - padding.bottom)}" fill="${config.areaFill}" stroke="none"></path>`
          : "";
      return `${area}<path d="${path}" fill="none" stroke="${line.color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></path>`;
    })
    .join("");

  const xLabels = [0, Math.floor(config.points.length / 2), config.points.length - 1]
    .map((index) => {
      const x = padding.left + xStep * index;
      return `<text x="${x}" y="${height - 12}" text-anchor="middle" fill="#94a8c8" font-size="11">${formatAxisDate(config.points[index].date)}</text>`;
    })
    .join("");

  const legend = config.series
    .map(
      (line, index) =>
        `<text x="${padding.left + index * 110}" y="16" fill="${line.color}" font-size="11">${line.label}</text>`
    )
    .join("");

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${guides}
    ${zeroLine}
    ${seriesMarkup}
    ${xLabels}
    ${legend}
  `;
}

function renderBarChart(svg, items) {
  const width = 520;
  const height = 220;
  const padding = { top: 28, right: 20, bottom: 34, left: 52 };
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.value)), 0.1);
  const plotWidth = width - padding.left - padding.right;
  const columnWidth = plotWidth / Math.max(items.length, 1);
  const zeroY = height / 2;

  const guides = [-maxAbs, 0, maxAbs]
    .map((value) => {
      const y = zeroY - (value / maxAbs) * (height - padding.top - padding.bottom) * 0.5;
      return `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(154,184,255,0.12)" stroke-dasharray="4 8"></line>
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="#94a8c8" font-size="11">${value.toFixed(1)}%</text>
      `;
    })
    .join("");

  const bars = items
    .map((item, index) => {
      const barHeight = (Math.abs(item.value) / maxAbs) * (height - padding.top - padding.bottom) * 0.5;
      const x = padding.left + index * columnWidth + columnWidth * 0.16;
      const y = item.value >= 0 ? zeroY - barHeight : zeroY;
      const color = item.value >= 0 ? "#6ef2d2" : "#ff8f8f";
      const labelY = item.value >= 0 ? y - 8 : y + barHeight + 16;
      return `
        <rect x="${x}" y="${y}" width="${columnWidth * 0.68}" height="${Math.max(barHeight, 2)}" rx="10" fill="${color}" opacity="0.88"></rect>
        <text x="${x + columnWidth * 0.34}" y="${labelY}" text-anchor="middle" fill="#f5f8ff" font-size="11">${formatSignedNumber(item.value)}%</text>
        <text x="${x + columnWidth * 0.34}" y="${height - 10}" text-anchor="middle" fill="#94a8c8" font-size="11">${item.label}</text>
      `;
    })
    .join("");

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${guides}
    <line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="rgba(255,255,255,0.18)"></line>
    ${bars}
  `;
}

function buildSvgPlaceholder(width, height, label) {
  return `
    <defs>
      <linearGradient id="placeholderGradient" x1="0" x2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.04)"></stop>
        <stop offset="50%" stop-color="rgba(141,179,255,0.2)"></stop>
        <stop offset="100%" stop-color="rgba(255,255,255,0.04)"></stop>
        <animate attributeName="x1" from="-1" to="1" dur="1.2s" repeatCount="indefinite"></animate>
        <animate attributeName="x2" from="0" to="2" dur="1.2s" repeatCount="indefinite"></animate>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    <rect x="24" y="24" width="${width - 48}" height="${height - 68}" rx="18" fill="url(#placeholderGradient)"></rect>
    <text x="${width / 2}" y="${height - 20}" text-anchor="middle" fill="#94a8c8" font-size="12">${label}</text>
  `;
}

function setLoadingState(base, target) {
  latestFxLiveQuote = null;
  latestRate.textContent = "-";
  latestRateDate.textContent = `${base}/${target} 불러오는 중`;
  monthlyMomentum.textContent = "-";
  forecast3m.textContent = "-";
  forecast3mBand.textContent = "예측 계산 중";
  forecast6m.textContent = "-";
  forecast6mBand.textContent = "예측 계산 중";
  forecast12m.textContent = "-";
  forecast12mBand.textContent = "예측 계산 중";
  volatilityValue.textContent = "-";
  nextSessionForecastValue.textContent = "-";
  nextSessionDetailValue.textContent = "1-day short-horizon model";
  sevenDayForecastValue.textContent = "-";
  sevenDayDetailValue.textContent = "7-day short-horizon model";
  oneDayBacktestValue.textContent = "-";
  oneDayBacktestDetailValue.textContent = "RMSE / hit rate";
  sevenDayBacktestValue.textContent = "-";
  sevenDayBacktestDetailValue.textContent = "RMSE / hit rate";
  compareAReturn.textContent = "-";
  compareALabel.textContent = "-";
  compareBReturn.textContent = "-";
  compareBLabel.textContent = "-";
  compareGap.textContent = "-";
  compareVolatility.textContent = "-";
  factorPremiumValue.textContent = "-";
  meanReversionValue.textContent = "-";
  modelConfidenceValue.textContent = "-";
  regimeStateValue.textContent = "-";
  regimeDetailValue.textContent = "-";
  backtestRmseValue.textContent = "-";
  hitRateValue.textContent = "-";
  hitRateLabelValue.textContent = "Walk-forward benchmark";
  annualDriftValue.textContent = "-";
  quantTopWeightValue.textContent = "-";
  quantTopWeightDetailValue.textContent = "Loading quant snapshot";
  quantPortfolioVolValue.textContent = "-";
  quantExpectedShortfallValue.textContent = "-";
  quantForecastModeValue.textContent = "-";
  quantForecastDetailValue.textContent = "Connecting to backend";
  crossAssetSignalValue.textContent = "-";
  crossAssetSignalDetailValue.textContent = "Computing cross-asset signal";
  tradeActionValue.textContent = "-";
  tradeActionDetailValue.textContent = "Building trade stance";
  equitySignalValue.textContent = "-";
  equitySignalDetailValue.textContent = "SPY + AAPL";
  ratesSignalValue.textContent = "-";
  ratesSignalDetailValue.textContent = "DXY + VIX + WTI";
  decisionSummary.textContent = "Rebuilding the narrative around the new forecast so the result is easier to understand.";
  oneDayDriverList.innerHTML = renderDriverList([]);
  sevenDayDriverList.innerHTML = renderDriverList([]);
  accuracySummary.textContent = "Backtest guardrails will appear once the short-horizon quant engine responds.";
  reviewArchiveCountValue.textContent = "-";
  reviewArchiveDetailValue.textContent = "Rebuilding prediction archive";
  reviewOneDayAccuracyValue.textContent = "-";
  reviewOneDayDetailValue.textContent = "Hit rate / RMSE";
  reviewSevenDayAccuracyValue.textContent = "-";
  reviewSevenDayDetailValue.textContent = "Hit rate / RMSE";
  reviewCalibrationModeValue.textContent = "-";
  reviewCalibrationDetailValue.textContent = "Bias and shrink factors";
  reviewRows.innerHTML = '<article class="review-row review-row-empty">Refreshing archived prediction checks.</article>';
  insightText.textContent = "Refreshing the market snapshot and recalculating the macro signal stack.";
  formulaText.textContent = "Rebuilding the forecast equation and volatility estimate.";
  lastUpdated.textContent = "Requesting fresh data...";
  chart.innerHTML = buildSvgPlaceholder(960, 420, `${base}/${target} trend deck is loading`);
  momentumChart.innerHTML = buildSvgPlaceholder(520, 220, "Momentum map is loading");
  volatilityChart.innerHTML = buildSvgPlaceholder(520, 220, "Volatility pulse is loading");
  reversionChart.innerHTML = buildSvgPlaceholder(520, 220, "Reversion gap is loading");
  termStructureChart.innerHTML = buildSvgPlaceholder(520, 220, "Forecast ladder is loading");
  currentRefreshProgress = 0;
  setRefreshProgress(6, `Initializing ${base}/${target} refresh`, 0, true);
}

function renderErrorState(errorMessage) {
  chart.innerHTML = buildSvgPlaceholder(960, 420, "Update failed - try refresh again");
  momentumChart.innerHTML = buildSvgPlaceholder(520, 220, "Momentum chart unavailable");
  volatilityChart.innerHTML = buildSvgPlaceholder(520, 220, "Volatility chart unavailable");
  reversionChart.innerHTML = buildSvgPlaceholder(520, 220, "Reversion chart unavailable");
  termStructureChart.innerHTML = buildSvgPlaceholder(520, 220, "Forecast ladder unavailable");
  lastUpdated.textContent = "Update failed";
  marketNote.textContent =
    errorMessage ||
    "The local data engine or one of the upstream market feeds did not respond cleanly.";
  decisionSummary.textContent = "The result narrative could not be rebuilt because one of the required market or quant inputs failed to load.";
  accuracySummary.textContent = "Treat the current view as incomplete until the next clean refresh finishes.";
  setRefreshProgress(100, "Refresh failed", -1, true);
  setRefreshButtonState(false);
}

function updateSliderLabels() {
  sliderValueMap.riskOff.textContent = Number(riskOffInput.value).toFixed(1);
  sliderValueMap.rateDiff.textContent = Number(rateDiffInput.value).toFixed(1);
  sliderValueMap.commodityShock.textContent = Number(commodityShockInput.value).toFixed(1);
  sliderValueMap.usdLiquidity.textContent = Number(usdLiquidityInput.value).toFixed(1);
}

function setRefreshButtonState(isLoading) {
  refreshButton.disabled = isLoading;
  refreshButton.textContent = isLoading ? "Refreshing..." : "Refresh Data";
  document.body.classList.toggle("is-refreshing", isLoading);
}

function setRefreshProgress(percent, stageLabel, activeStepIndex, force = false) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const nextPercent = force ? safePercent : Math.max(currentRefreshProgress, safePercent);
  currentRefreshProgress = nextPercent;
  progressStageLabel.textContent = stageLabel;
  progressPercentLabel.textContent = `${nextPercent}%`;
  progressFill.style.width = `${nextPercent}%`;
  if (loaderHint) {
    loaderHint.textContent = stageLabel;
  }
  if (progressTrack) {
    progressTrack.setAttribute("aria-valuenow", String(nextPercent));
  }

  const stepNodes = progressStepList ? [...progressStepList.querySelectorAll(".progress-step")] : [];
  stepNodes.forEach((node, index) => {
    node.classList.remove("is-active", "is-done", "is-error");
    if (activeStepIndex < 0) {
      if (index === 0) {
        node.classList.add("is-error");
      }
      return;
    }
    if (index < activeStepIndex) {
      node.classList.add("is-done");
    } else if (index === activeStepIndex) {
      node.classList.add("is-active");
    }
  });

  if (nextPercent >= 100 && activeStepIndex >= 0) {
    stepNodes.forEach((node) => {
      node.classList.remove("is-active");
      node.classList.add("is-done");
    });
  }
}

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = FX_REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = mergeAbortSignals(fetchOptions.signal, timeoutController.signal);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mergeAbortSignals(...signals) {
  const validSignals = signals.filter(Boolean);
  if (!validSignals.length) {
    return undefined;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  validSignals.forEach((signal) => {
    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener("abort", abort, { once: true });
    }
  });

  return controller.signal;
}

function buildCacheKey(base, target) {
  return `fx-pulse:${FX_CACHE_VERSION}:${base}:${target}`;
}

function writeSeriesCache(cacheKey, series) {
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        series,
      })
    );
  } catch (error) {
    console.warn("Failed to persist FX cache", error);
  }
}

function readSeriesCache(cacheKey) {
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.series)) {
      return [];
    }

    return parsed.series
      .filter((entry) => entry && typeof entry.date === "string" && Number.isFinite(entry.value))
      .sort((left, right) => left.date.localeCompare(right.date));
  } catch (error) {
    console.warn("Failed to read FX cache", error);
    return [];
  }
}

function getForecastPoint(points, index) {
  return points[Math.min(index, points.length - 1)];
}

function renderEmptyAssetState(message) {
  const card = `
    <div class="empty-asset-card">
      <strong>시장 데이터 대기 중</strong>
      <p>${message}</p>
    </div>
  `;
  equityCards.innerHTML = card;
  bondCards.innerHTML = card;
  assetStatusText.textContent = message;
}

function renderEmptyNewsState(message) {
  newsList.innerHTML = `
    <div class="empty-asset-card">
      <strong>뉴스 대기 중</strong>
      <p>${message}</p>
    </div>
  `;
  newsSummaryText.textContent = "실시간 뉴스를 불러오면 통화쌍/자산별 중요도를 요약해서 보여줍니다.";
}

function parseGlobalQuote(payload, fallbackSymbol) {
  const quote = payload["Global Quote"];
  if (!quote) {
    throw new Error(`주식 데이터 응답 형식이 올바르지 않습니다: ${fallbackSymbol}`);
  }

  return {
    symbol: quote["01. symbol"] || fallbackSymbol,
    price: Number(quote["05. price"]),
    change: Number(quote["09. change"]),
    changePercent: Number(String(quote["10. change percent"] || "0").replace("%", "")),
    latestDay: quote["07. latest trading day"] || "",
  };
}

function parseTwelveDataQuote(item, fallbackSymbol) {
  const symbol = item.symbol || fallbackSymbol;
  const price = Number(item.close || item.price);
  const previousClose = Number(item.previous_close || item.prev_close);
  const percentChange = Number(String(item.percent_change || item.change_percent || "0").replace("%", ""));
  const parsedChange = Number(item.change);
  const change = Number.isFinite(parsedChange)
    ? parsedChange
    : Number.isFinite(previousClose) && Number.isFinite(price)
      ? price - previousClose
      : 0;

  if (!symbol || !Number.isFinite(price)) {
    return null;
  }

  return {
    symbol,
    price,
    change,
    changePercent: Number.isFinite(percentChange) ? percentChange : previousClose ? (change / previousClose) * 100 : 0,
    latestDay: item.datetime || item.timestamp || "",
  };
}

function parseTreasuryXml(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) {
    throw new Error("미국채 XML 데이터를 해석하지 못했습니다.");
  }
  const entries = [...xml.querySelectorAll("entry")];

  const parsed = entries
    .map((entry) => {
      const date = pickXmlValue(entry, ["NEW_DATE"]);
      const yields = Object.fromEntries(
        Object.entries(TREASURY_FIELD_MAP).map(([maturity, selectors]) => [
          maturity,
          Number(pickXmlValue(entry, selectors)),
        ])
      );

      return { date, yields };
    })
    .filter((item) => item.date && Number.isFinite(item.yields["2year"]) && Number.isFinite(item.yields["10year"]))
    .sort((left, right) => left.date.localeCompare(right.date));

  const latest = parsed.at(-1);
  if (!latest) {
    return [];
  }

  return BOND_MATURITIES
    .map((maturity) => ({
      maturity,
      date: latest.date,
      yield: latest.yields[maturity],
    }))
    .filter((item) => Number.isFinite(item.yield));
}

function pickXmlValue(entry, selectors) {
  for (const selector of selectors) {
    const localName = selector.split(":").pop().trim().split(" ").pop();
    const nodes = entry.getElementsByTagNameNS("*", localName);
    if (nodes.length && nodes[0].textContent) {
      return nodes[0].textContent.trim();
    }
    const plainNodes = entry.getElementsByTagName(localName);
    if (plainNodes.length && plainNodes[0].textContent) {
      return plainNodes[0].textContent.trim();
    }
  }
  return "";
}

function renderEquityCard(asset) {
  const changeClass = asset.change >= 0 ? "positive" : "negative";
  const latestStamp = asset.latestDay
    ? `${asset.latestDay}${String(asset.latestDay).includes(":") ? " live" : " close"}`
    : "-";
  return `
    <div class="asset-card">
      <div class="asset-card-header">
        <strong>${asset.symbol}</strong>
        <span>${latestStamp}</span>
      </div>
      <div class="asset-price">${formatAssetPrice(asset.price)}</div>
      <div class="asset-change ${changeClass}">
        ${formatSignedNumber(asset.change)} (${formatPercent(asset.changePercent)})
      </div>
      <div class="asset-card-footer">
        <small>대표 주식/ETF</small>
        <small>${escapeHtml(asset.source || "Market Data")}</small>
      </div>
    </div>
  `;
}

function renderBondCard(asset) {
  return `
    <div class="asset-card">
      <div class="asset-card-header">
        <strong>${escapeHtml(BOND_LABELS[asset.maturity] || asset.maturity)}</strong>
        <span>${asset.date ? `${asset.date} session` : "-"}</span>
      </div>
      <div class="asset-price">${asset.yield.toFixed(2)}%</div>
      <div class="asset-change ${asset.yield >= 4 ? "negative" : "positive"}">
        금리 레벨 모니터링
      </div>
      <div class="asset-card-footer">
        <small>미국 국채 수익률</small>
        <small>${escapeHtml(asset.source || "Treasury Yield")}</small>
      </div>
    </div>
  `;
}

function calculateYieldSpread(bonds) {
  const twoYear = bonds.find((bond) => bond.maturity === "2year");
  const tenYear = bonds.find((bond) => bond.maturity === "10year");
  if (!twoYear || !tenYear) {
    return 0;
  }
  return tenYear.yield - twoYear.yield;
}

function renderSpreadCard(spread) {
  const changeClass = spread >= 0 ? "positive" : "negative";
  return `
    <div class="asset-card">
      <div class="asset-card-header">
        <strong>10Y - 2Y Spread</strong>
        <span>Yield Curve</span>
      </div>
      <div class="asset-price">${formatSignedNumber(spread)}%p</div>
      <div class="asset-change ${changeClass}">
        ${spread >= 0 ? "정상 우상향 커브" : "역전 구간 주의"}
      </div>
      <div class="asset-card-footer">
        <small>장단기 금리차</small>
        <small>2Y/10Y</small>
      </div>
    </div>
  `;
}

function normalizeNewsItem(item) {
  const title = item.title || "";
  const url = item.url || "#";
  const source = item.source || item.source_domain || "Unknown";
  const sourceDomain = String(item.source_domain || item.source || "").toLowerCase();
  const summary = item.summary || "요약 정보가 없습니다.";
  const timePublished = item.time_published || item.time_published_utc || "";
  const sentiment = Number(item.overall_sentiment_score || 0);
  const topics = Array.isArray(item.topics) ? item.topics.map((entry) => entry.topic).filter(Boolean) : [];
  const tickers = Array.isArray(item.ticker_sentiment)
    ? item.ticker_sentiment.map((entry) => entry.ticker).filter(Boolean)
    : [];

  if (!title || !url || !sourceDomain) {
    return null;
  }

  return {
    title,
    url,
    source,
    sourceDomain,
    summary,
    timePublished,
    sentiment,
    topics,
    tickers,
  };
}

function renderNewsCard(item) {
  const tags = [
    item.priorityTag ? `<span class="news-tag priority">${escapeHtml(item.priorityTag)}</span>` : "",
    item.impactLevel ? `<span class="news-tag impact-high">${escapeHtml(item.impactLevel)}</span>` : "",
    ...(item.assetTags || []).map(
      (tag) => `<span class="news-tag asset-${tag.toLowerCase()}">${escapeHtml(tag)}</span>`
    ),
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="news-card">
      <div class="news-meta">
        <span class="news-source">${escapeHtml(item.source)}</span>
        <span class="news-time">${formatNewsTime(item.timePublished)}</span>
      </div>
      <div class="news-tags">${tags}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="news-footer">
        <span>Sentiment ${formatSignedNumber(item.sentiment)} / Score ${item.relevanceScore.toFixed(1)}</span>
        <a class="news-link" href="${item.url}" target="_blank" rel="noreferrer">기사 보기</a>
      </div>
    </article>
  `;
}

function rankNewsItems(items, base, target) {
  return (Array.isArray(items) ? items : [])
    .map((item) => enrichNewsItem(item, base, target))
    .sort((left, right) => right.relevanceScore - left.relevanceScore);
}

function enrichNewsItem(item, base, target) {
  const topics = Array.isArray(item.topics) ? item.topics : [];
  const tickers = Array.isArray(item.tickers) ? item.tickers : [];
  const haystack = `${item.title || ""} ${item.summary || ""} ${topics.join(" ")} ${tickers.join(" ")}`.toLowerCase();
  const baseProfile = CURRENCY_NEWS_PROFILES[base] || { keywords: [base.toLowerCase()], tickers: [] };
  const targetProfile = CURRENCY_NEWS_PROFILES[target] || { keywords: [target.toLowerCase()], tickers: [] };
  const baseHits = countProfileHits(haystack, tickers, baseProfile);
  const targetHits = countProfileHits(haystack, tickers, targetProfile);
  const fxTag = baseHits + targetHits > 0;
  const bondTag = hasAnyKeyword(haystack, ["yield", "treasury", "bond", "fomc", "rate decision", "curve"]);
  const equityTag = hasAnyKeyword(haystack, ["equity", "stocks", "earnings", "s&p", "nasdaq", "apple", "microsoft"]);
  const assetTags = [fxTag ? "FX" : "", bondTag ? "Bond" : "", equityTag ? "Equity" : ""].filter(Boolean);
  const priorityScore = baseHits * 2.2 + targetHits * 2.2;
  const topicScore = topics.length * 0.45 + tickers.length * 0.3;
  const sentimentScore = Math.abs(Number(item.sentiment || 0)) * 1.8;
  const assetScore = assetTags.length * 0.8;
  const relevanceScore = priorityScore + topicScore + sentimentScore + assetScore;

  return {
    ...item,
    topics,
    tickers,
    assetTags,
    relevanceScore,
    priorityTag: priorityScore > 1 ? `${base}/${target} 우선` : "시장 일반",
    impactLevel: relevanceScore >= 6 ? "High Impact" : relevanceScore >= 3.5 ? "Medium Impact" : "Monitor",
  };
}

function mergeMarketData(primary, fallback) {
  const primaryData = primary || {};
  const fallbackData = fallback || {};
  const equities = dedupeAssets([
    ...(Array.isArray(primaryData.equities) ? primaryData.equities : []),
    ...(Array.isArray(fallbackData.equities) ? fallbackData.equities : []),
  ], "symbol").slice(0, EQUITY_SYMBOLS.length);
  const bonds = dedupeAssets([
    ...(Array.isArray(primaryData.bonds) ? primaryData.bonds : []),
    ...(Array.isArray(fallbackData.bonds) ? fallbackData.bonds : []),
  ], "maturity").slice(0, BOND_MATURITIES.length);

  return {
    updatedAt: fallbackData.updatedAt || primaryData.updatedAt || new Date().toISOString(),
    equities,
    bonds,
    spread: calculateYieldSpread(bonds),
  };
}

function dedupeAssets(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item && item[key];
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, ms);
    if (!signal) {
      return;
    }
    const abort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

function countProfileHits(haystack, tickers, profile) {
  const keywordHits = profile.keywords.reduce((count, keyword) => count + (haystack.includes(keyword.toLowerCase()) ? 1 : 0), 0);
  const tickerHits = profile.tickers.reduce((count, ticker) => count + (tickers.includes(ticker) ? 1 : 0), 0);
  return keywordHits + tickerHits;
}

function hasAnyKeyword(haystack, keywords) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function buildNewsSummary(items, base, target) {
  if (!items.length) {
    return `${base}/${target} 관련 주요 뉴스가 아직 없습니다.`;
  }

  const top = items.slice(0, 3);
  const highImpactCount = items.filter((item) => item.impactLevel === "High Impact").length;
  const fxCount = items.filter((item) => item.assetTags.includes("FX")).length;
  const bondCount = items.filter((item) => item.assetTags.includes("Bond")).length;
  const equityCount = items.filter((item) => item.assetTags.includes("Equity")).length;

  return `${base}/${target} 기준 우선 뉴스 ${top.length}건을 반영했습니다. 고영향 기사 ${highImpactCount}건, FX 연관 ${fxCount}건, 채권 연관 ${bondCount}건, 주식 연관 ${equityCount}건이며, 대표 헤드라인은 "${top
    .map((item) => item.title)
    .join('", "')}" 입니다.`;
}

function renderMacroCalendar() {
  const today = new Date();
  const upcoming = MACRO_EVENTS_2026.filter((event) => new Date(event.date) >= startOfDay(today)).slice(0, 5);
  macroCalendarList.innerHTML = upcoming.map((event) => renderMacroEvent(event)).join("");
}

function renderMacroEvent(event) {
  return `
    <a class="macro-event news-link" href="${event.url}" target="_blank" rel="noreferrer">
      <div class="macro-event-top">
        <strong>${escapeHtml(event.title)}</strong>
        <span class="macro-event-date">${formatShortDate(event.date)}</span>
      </div>
      <span class="macro-event-source">${escapeHtml(event.source)}</span>
      <div class="macro-event-tags">
        ${event.tags.map((tag) => `<span class="macro-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </a>
  `;
}

function writeMultiAssetCache(payload) {
  try {
    window.localStorage.setItem(MULTI_ASSET_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist multi asset cache", error);
  }
}

function readMultiAssetCache() {
  try {
    const raw = window.localStorage.getItem(MULTI_ASSET_CACHE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to read multi asset cache", error);
    return null;
  }
}

function writeNewsCache(items) {
  try {
    window.localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Failed to persist news cache", error);
  }
}

function readNewsCache() {
  try {
    const raw = window.localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read news cache", error);
    return [];
  }
}

function readStoredApiKey() {
  try {
    return window.localStorage.getItem(ALPHA_VANTAGE_STORAGE_KEY) || "";
  } catch (error) {
    console.warn("Failed to read stored API key", error);
    return "";
  }
}

function getEffectiveAlphaVantageKey() {
  return readStoredApiKey() || ALPHA_VANTAGE_DEFAULT_KEY;
}

function calculateEwmaVolatility(values, lambda) {
  if (!values.length) {
    return 0;
  }

  let variance = values[0] ** 2;
  for (let index = 1; index < values.length; index += 1) {
    variance = lambda * variance + (1 - lambda) * values[index] ** 2;
  }
  return Math.sqrt(Math.max(variance, 0));
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function detectRegime(recent21, recent60, ewmaVolDaily) {
  const shortMomentum = weightedAverage(recent21) * TRADING_DAYS_YEAR;
  const mediumMomentum = average(recent60) * TRADING_DAYS_YEAR;
  const annualVol = ewmaVolDaily * Math.sqrt(TRADING_DAYS_YEAR);

  if (annualVol > 0.16) {
    return {
      name: "Stress",
      description: "고변동성 구간, 평균회귀 비중 확대",
      momentumWeight: 0.65,
      reversionWeight: 1.25,
      factorWeight: 1.15,
    };
  }

  if (shortMomentum > 0 && mediumMomentum > 0) {
    return {
      name: "Trend",
      description: "모멘텀 지속 구간, 추세 비중 확대",
      momentumWeight: 1.25,
      reversionWeight: 0.8,
      factorWeight: 1,
    };
  }

  return {
    name: "Balanced",
    description: "중립 구간, 모멘텀/회귀 균형 적용",
    momentumWeight: 1,
    reversionWeight: 1,
    factorWeight: 1,
  };
}

function runWalkForwardBacktest(series, factors, base, target) {
  const lookback = 180;
  const factorPremiumBase = deriveFactorPremium(factors, base, target);
  const bucketStore = Object.fromEntries(
    FORECAST_BACKTEST_HORIZONS.map((horizon) => [
      horizon,
      {
        errors: [],
        absoluteErrors: [],
        observations: [],
      },
    ])
  );

  for (let end = lookback; end < series.length - FORECAST_BACKTEST_HORIZONS[0]; end += 5) {
    const sample = series.slice(0, end + 1);
    const signalState = buildSignalState(sample, factorPremiumBase, 0);

    FORECAST_BACKTEST_HORIZONS.forEach((horizon) => {
      if (end + horizon >= series.length) {
        return;
      }

      const predicted = projectExpectedValue(signalState, horizon);
      const actual = series[end + horizon].value;
      const predictedMove = (predicted - signalState.latest.value) / signalState.latest.value;
      const actualMove = (actual - signalState.latest.value) / signalState.latest.value;
      const hit = predictedMove * actualMove > 0;
      const errorRatio = actual ? (predicted - actual) / actual : 0;

      bucketStore[horizon].errors.push(errorRatio ** 2);
      bucketStore[horizon].absoluteErrors.push(Math.abs(errorRatio));
      bucketStore[horizon].observations.push({
        confidence: Math.abs(predictedMove),
        hit,
      });
    });
  }

  const horizons = Object.fromEntries(
    FORECAST_BACKTEST_HORIZONS.map((horizon) => [
      horizon,
      summarizeBacktestBucket(
        bucketStore[horizon].errors,
        bucketStore[horizon].absoluteErrors,
        bucketStore[horizon].observations
      ),
    ])
  );
  const primary = horizons[20];

  return {
    rmse: primary.rmse,
    mae: primary.mae,
    hitRate: primary.hitRate,
    totalCount: primary.totalCount,
    qualifiedCount: primary.qualifiedCount,
    qualifiedHitRate: primary.qualifiedHitRate,
    horizons,
  };
}

function selectQualifiedBacktestSubset(observations) {
  const confidenceThreshold = 0.01;
  return observations.filter((item) => item.confidence >= confidenceThreshold);
}

function toReturns(series) {
  const returns = [];

  for (let index = 1; index < series.length; index += 1) {
    returns.push(Math.log(series[index].value / series[index - 1].value));
  }

  return returns;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function weightedAverage(values) {
  if (!values.length) {
    return 0;
  }

  const numerator = values.reduce((total, value, index) => total + value * (index + 1), 0);
  const denominator = values.reduce((total, _, index) => total + (index + 1), 0);
  return numerator / denominator;
}

function standardDeviation(values) {
  if (!values.length) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function handleVisibilityRefresh() {
  if (document.visibilityState === "visible") {
    loadDashboard();
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatAxisDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatRate(value, currency) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const isLargeNumber = Math.abs(value) >= 100;
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: isLargeNumber ? 2 : 0,
    maximumFractionDigits: currency === "JPY" || isLargeNumber ? 2 : 4,
  }).format(value);
}

function formatAssetPrice(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNewsTime(value) {
  if (!value) {
    return "-";
  }

  const parsed = value.includes("T") ? new Date(value) : new Date(formatAlphaVantageTimestamp(value));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatAlphaVantageTimestamp(value) {
  if (typeof value !== "string" || value.length < 12) {
    return value;
  }

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(9, 11) || "00";
  const minute = value.slice(11, 13) || "00";
  const second = value.slice(13, 15) || "00";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatShortRate(value, currency) {
  return new Intl.NumberFormat("ko-KR", {
    notation: value > 1000 ? "compact" : "standard",
    maximumFractionDigits: currency === "JPY" ? 1 : 2,
  }).format(value);
}

function formatPercent(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatSignedNumber(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function bandLabel(horizon, target) {
  return `${formatRate(horizon.low, target)} - ${formatRate(horizon.high, target)}`;
}
