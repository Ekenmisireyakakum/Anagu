import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEO_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'ANAGU-GIS-LandRegistry/1.0 (https://openstreetmap.org)',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const lat = searchParams.get('lat')?.trim();
  const lon = searchParams.get('lon')?.trim();

  if (lat && lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return NextResponse.json({ message: 'Invalid coordinates' }, { status: 400 });
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(latNum)}&lon=${encodeURIComponent(lonNum)}&zoom=17`,
        { headers: GEO_HEADERS, signal: AbortSignal.timeout(4500) },
      );
      if (res.ok) {
        const data = (await res.json()) as { display_name?: string };
        return NextResponse.json({ display_name: data.display_name || null });
      }
    } catch {
      // Fallback below
    }
    return NextResponse.json({ display_name: null });
  }

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}`,
      { headers: GEO_HEADERS, signal: AbortSignal.timeout(4500) },
    );
    if (nomRes.ok) {
      const items = (await nomRes.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      if (Array.isArray(items) && items.length > 0) {
        return NextResponse.json({ results: items });
      }
    }
  } catch {
    // Try Photon fallback
  }

  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?limit=3&q=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4500) },
    );
    if (photonRes.ok) {
      const data = (await photonRes.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] };
          properties?: { name?: string; street?: string; city?: string; country?: string };
        }>;
      };
      const results = (data.features || [])
        .filter((f) => Array.isArray(f.geometry?.coordinates) && f.geometry!.coordinates!.length >= 2)
        .map((f) => {
          const [fLon, fLat] = f.geometry!.coordinates!;
          const p = f.properties || {};
          const parts = [p.name, p.street, p.city, p.country].filter(Boolean);
          return {
            lat: String(fLat),
            lon: String(fLon),
            display_name: parts.join(', ') || `${fLat.toFixed(5)}, ${fLon.toFixed(5)}`,
          };
        });
      return NextResponse.json({ results });
    }
  } catch {
    // Non-fatal fallback
  }

  return NextResponse.json({ results: [] });
}
