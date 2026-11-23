export interface MarketRates {
  polUsd: number;
  polNgn: number;
  /** @deprecated Legacy schema alias mapped to POL/USD rate */
  ethUsd: number;
  /** @deprecated Legacy schema alias mapped to POL/NGN rate */
  ethNgn: number;
  usdNgn: number;
  source: string;
  updatedAt: string;
  isLive: boolean;
}

const DEFAULT_POL_USD = 0.25;
const DEFAULT_POL_NGN = 375;
const DEFAULT_USD_NGN = Math.round((DEFAULT_POL_NGN / DEFAULT_POL_USD) * 100) / 100;

const CACHE_TTL_MS = 60_000;

interface RatesCacheState {
  rates: MarketRates;
  expiresAt: number;
  inflight: Promise<MarketRates> | null;
}

const g = globalThis as typeof globalThis & { __anaguMarketRatesCache?: RatesCacheState };

export const FALLBACK_MARKET_RATES: MarketRates = {
  polUsd: DEFAULT_POL_USD,
  polNgn: DEFAULT_POL_NGN,
  ethUsd: DEFAULT_POL_USD,
  ethNgn: DEFAULT_POL_NGN,
  usdNgn: DEFAULT_USD_NGN,
  source: 'Polygon Baseline Rate',
  updatedAt: new Date().toISOString(),
  isLive: false,
};

function getCacheState(): RatesCacheState {
  if (!g.__anaguMarketRatesCache) {
    g.__anaguMarketRatesCache = {
      rates: { ...FALLBACK_MARKET_RATES, updatedAt: new Date().toISOString() },
      expiresAt: 0,
      inflight: null,
    };
  }
  return g.__anaguMarketRatesCache;
}

export function getCachedMarketRates(): MarketRates {
  return getCacheState().rates;
}

function buildMarketRates(polUsdRaw: number, polNgnRaw: number, source: string): MarketRates {
  const effectivePolNgn =
    Number.isFinite(polNgnRaw) && polNgnRaw > 0
      ? polNgnRaw
      : Math.round(polUsdRaw * DEFAULT_USD_NGN);
  const usdNgn = Math.round((effectivePolNgn / polUsdRaw) * 100) / 100;
  const polUsd = Math.round(polUsdRaw * 10000) / 10000;
  const polNgn = Math.round(effectivePolNgn * 100) / 100;

  return {
    polUsd,
    polNgn,
    ethUsd: polUsd,
    ethNgn: polNgn,
    usdNgn,
    source,
    updatedAt: new Date().toISOString(),
    isLive: true,
  };
}

async function fetchFromCoinGecko(): Promise<MarketRates | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token,matic-network&vs_currencies=usd,ngn',
      {
        signal: AbortSignal.timeout(2500),
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      'polygon-ecosystem-token'?: { usd?: number; ngn?: number };
      'matic-network'?: { usd?: number; ngn?: number };
    };
    const entry = data?.['polygon-ecosystem-token'] || data?.['matic-network'];
    const polUsd = Number(entry?.usd);
    const polNgn = Number(entry?.ngn);
    if (!Number.isFinite(polUsd) || polUsd <= 0) return null;

    return buildMarketRates(polUsd, polNgn, 'CoinGecko Live (POL)');
  } catch {
    return null;
  }
}

async function fetchFromCoinbase(): Promise<MarketRates | null> {
  for (const symbol of ['POL', 'MATIC']) {
    try {
      const res = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${symbol}`, {
        signal: AbortSignal.timeout(2500),
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: { rates?: { USD?: string; NGN?: string } };
      };
      const polUsd = Number(data?.data?.rates?.USD);
      const polNgn = Number(data?.data?.rates?.NGN);
      if (!Number.isFinite(polUsd) || polUsd <= 0) continue;

      return buildMarketRates(polUsd, polNgn, 'Coinbase Live (POL)');
    } catch {
      continue;
    }
  }
  return null;
}

export async function refreshMarketRates(force = false): Promise<MarketRates> {
  const state = getCacheState();
  if (!force && state.expiresAt > Date.now()) {
    return state.rates;
  }
  if (!force && state.inflight) {
    return state.inflight;
  }

  const run = (async () => {
    const live = (await fetchFromCoinGecko()) || (await fetchFromCoinbase());
    if (live) {
      state.rates = live;
      state.expiresAt = Date.now() + CACHE_TTL_MS;
    } else {
      state.rates = {
        ...state.rates,
        source: state.rates.isLive ? `${state.rates.source} (Cached)` : 'Polygon Baseline Rate',
        updatedAt: state.rates.updatedAt || new Date().toISOString(),
      };
      state.expiresAt = Date.now() + 15_000;
    }
    return state.rates;
  })().finally(() => {
    state.inflight = null;
  });

  state.inflight = run;
  return run;
}

export function formatPolAmount(pol: number): string {
  if (!Number.isFinite(pol) || pol <= 0) return '0.00';
  if (pol >= 100) {
    return pol.toFixed(2);
  }
  if (pol >= 0.001) {
    return pol.toFixed(4);
  }
  return pol.toFixed(6);
}

export const formatEthAmount = formatPolAmount;

export function usdToPol(usd: number, rates: MarketRates = getCachedMarketRates()): string {
  const rate = rates.polUsd ?? rates.ethUsd;
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return '0.00';
  }
  return formatPolAmount(usd / rate);
}

export const usdToEth = usdToPol;

export function polToUsd(pol: string | number, rates: MarketRates = getCachedMarketRates()): number {
  const rate = rates.polUsd ?? rates.ethUsd;
  const num = Number(pol);
  if (!Number.isFinite(num) || num <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  const usd = num * rate;
  return usd >= 100 ? Math.round(usd) : Math.round(usd * 100) / 100;
}

export const ethToUsd = polToUsd;

export function usdToNgn(usd: number, rates: MarketRates = getCachedMarketRates()): number {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rates.usdNgn) || rates.usdNgn <= 0) {
    return 0;
  }
  return Math.round(usd * rates.usdNgn);
}

export function ngnToUsd(ngn: number, rates: MarketRates = getCachedMarketRates()): number {
  if (!Number.isFinite(ngn) || ngn <= 0 || !Number.isFinite(rates.usdNgn) || rates.usdNgn <= 0) {
    return 0;
  }
  const usd = ngn / rates.usdNgn;
  return usd >= 100 ? Math.round(usd) : Math.round(usd * 100) / 100;
}

export function ngnToPol(ngn: number, rates: MarketRates = getCachedMarketRates()): string {
  const rate = rates.polNgn ?? rates.ethNgn;
  if (!Number.isFinite(ngn) || ngn <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return '0.00';
  }
  return formatPolAmount(ngn / rate);
}

export const ngnToEth = ngnToPol;
