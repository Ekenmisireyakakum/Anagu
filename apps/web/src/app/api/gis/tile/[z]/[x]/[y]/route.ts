import { NextRequest, NextResponse } from 'next/server';

const MAX_CACHE_ENTRIES = 600;

const g = globalThis as typeof globalThis & {
  __anaguTileCache?: Map<string, { data: ArrayBuffer; contentType: string; cachedAt: number }>;
};

function getTileCache() {
  if (!g.__anaguTileCache) {
    g.__anaguTileCache = new Map();
  }
  return g.__anaguTileCache;
}

async function fetchTileFromProvider(
  url: string,
  headers?: Record<string, string>,
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    if (res.headers.get('x-blocked')) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) return null;
    const data = await res.arrayBuffer();
    if (!data || data.byteLength < 100) return null;
    return { data, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: { z: string; x: string; y: string } },
) {
  const z = Number.parseInt(context.params.z, 10);
  const x = Number.parseInt(context.params.x, 10);
  const yClean = context.params.y.replace(/\.png$/i, '');
  const y = Number.parseInt(yClean, 10);

  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    z > 19
  ) {
    return NextResponse.json({ message: 'Invalid tile coordinates' }, { status: 400 });
  }

  const maxCoord = Math.pow(2, z);
  if (x < 0 || x >= maxCoord || y < 0 || y >= maxCoord) {
    return NextResponse.json({ message: 'Tile coordinate out of bounds' }, { status: 400 });
  }

  const cacheKey = `${z}/${x}/${y}`;
  const cache = getTileCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    return new NextResponse(cached.data, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  }

  // Primary: OpenStreetMap with compliant application User-Agent (avoids Referer-stripping 403s)
  let tile = await fetchTileFromProvider(
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    {
      'User-Agent': 'ANAGU-GIS-Cadastre/1.0 (+https://anagu.gov.ng)',
      Accept: 'image/png,image/*,*/*;q=0.8',
    },
  );

  // Fallback: CartoDB Voyager (OpenStreetMap-derived raster tiles) if OSM blocks or rate-limits
  if (!tile) {
    const sub = ['a', 'b', 'c', 'd'][(x + y) % 4];
    tile = await fetchTileFromProvider(
      `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
      {
        'User-Agent': 'ANAGU-GIS-Cadastre/1.0 (+https://anagu.gov.ng)',
        Accept: 'image/png,image/*,*/*;q=0.8',
      },
    );
  }

  if (!tile) {
    return new NextResponse(null, { status: 502 });
  }

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(cacheKey, { ...tile, cachedAt: Date.now() });

  return new NextResponse(tile.data, {
    status: 200,
    headers: {
      'Content-Type': tile.contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
