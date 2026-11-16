export interface MarketRates {
  ethUsd: number;
  ethNgn: number;
  usdNgn: number;
  source: string;
  updatedAt: string;
  isLive: boolean;
}

const DEFAULT_ETH_USD = 1828.76;
const DEFAULT_ETH_NGN = 2461288;
const DEFAULT_USD_NGN = Math.round((DEFAULT_ETH_NGN / DEFAULT_ETH_USD) * 100) / 100;

const CACHE_TTL_MS = 60_000;

interface RatesCacheState {
  rates: MarketRates;
  expiresAt: number;
  inflight: Promise<MarketRates> | null;
}

const g = globalThis as typeof globalThis & { __anaguMarketRatesCache?: RatesCacheState };

export const FALLBACK_MARKET_RATES: MarketRates = {
  ethUsd: DEFAULT_ETH_USD,
  ethNgn: DEFAULT_ETH_NGN,
  usdNgn: DEFAULT_USD_NGN,
  source: 'Baseline Market Rate',
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

async function fetchFromCoinGecko(): Promise<MarketRates | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,ngn',
      {
        signal: AbortSignal.timeout(2500),
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ethereum?: { usd?: number; ngn?: number };
    };
    const ethUsd = Number(data?.ethereum?.usd);
    const ethNgn = Number(data?.ethereum?.ngn);
    if (!Number.isFinite(ethUsd) || ethUsd <= 0) return null;

    const effectiveEthNgn =
      Number.isFinite(ethNgn) && ethNgn > 0 ? ethNgn : Math.round(ethUsd * DEFAULT_USD_NGN);
    const usdNgn = Math.round((effectiveEthNgn / ethUsd) * 100) / 100;

    return {
      ethUsd: Math.round(ethUsd * 100) / 100,
      ethNgn: Math.round(effectiveEthNgn),
      usdNgn,
      source: 'CoinGecko Live',
      updatedAt: new Date().toISOString(),
      isLive: true,
    };
  } catch {
    return null;
  }
}

async function fetchFromCoinbase(): Promise<MarketRates | null> {
  try {
    const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH', {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { rates?: { USD?: string; NGN?: string } };
    };
    const ethUsd = Number(data?.data?.rates?.USD);
    const ethNgn = Number(data?.data?.rates?.NGN);
    if (!Number.isFinite(ethUsd) || ethUsd <= 0) return null;

    const effectiveEthNgn =
      Number.isFinite(ethNgn) && ethNgn > 0 ? ethNgn : Math.round(ethUsd * DEFAULT_USD_NGN);
    const usdNgn = Math.round((effectiveEthNgn / ethUsd) * 100) / 100;

    return {
      ethUsd: Math.round(ethUsd * 100) / 100,
      ethNgn: Math.round(effectiveEthNgn),
      usdNgn,
      source: 'Coinbase Live',
      updatedAt: new Date().toISOString(),
      isLive: true,
    };
  } catch {
    return null;
  }
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
        source: state.rates.isLive ? `${state.rates.source} (Cached)` : 'Baseline Market Rate',
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

export function formatEthAmount(eth: number): string {
  if (!Number.isFinite(eth) || eth <= 0) return '0.0000';
  if (eth >= 0.001) {
    return eth.toFixed(4);
  }
  return eth.toFixed(6);
}

export function usdToEth(usd: number, rates: MarketRates = getCachedMarketRates()): string {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rates.ethUsd) || rates.ethUsd <= 0) {
    return '0.0000';
  }
  return formatEthAmount(usd / rates.ethUsd);
}

export function ethToUsd(eth: string | number, rates: MarketRates = getCachedMarketRates()): number {
  const num = Number(eth);
  if (!Number.isFinite(num) || num <= 0 || !Number.isFinite(rates.ethUsd) || rates.ethUsd <= 0) {
    return 0;
  }
  const usd = num * rates.ethUsd;
  return usd >= 100 ? Math.round(usd) : Math.round(usd * 100) / 100;
}

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

export function ngnToEth(ngn: number, rates: MarketRates = getCachedMarketRates()): string {
  if (!Number.isFinite(ngn) || ngn <= 0 || !Number.isFinite(rates.ethNgn) || rates.ethNgn <= 0) {
    return '0.0000';
  }
  return formatEthAmount(ngn / rates.ethNgn);
}
