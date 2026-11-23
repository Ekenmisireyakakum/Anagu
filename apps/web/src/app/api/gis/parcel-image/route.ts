import { NextRequest, NextResponse } from 'next/server';
import {
  computeGeodesicAreaSqm,
  computeMercatorParcelScene,
  formatArea,
  wktToLatLngs,
} from '../../../../lib/gis-utils';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wkt = (searchParams.get('wkt') || '').trim();
  const ref = (searchParams.get('ref') || 'ANAGU-GIS').trim().slice(0, 48);
  const status = (searchParams.get('status') || '').trim().toUpperCase();

  const width = 640;
  const height = 420;
  const scene = wkt ? computeMercatorParcelScene(wkt, width, height) : null;
  const latLngs = wkt ? wktToLatLngs(wkt) : [];

  if (!scene || latLngs.length < 3) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f1f5f9"/>
  <text x="320" y="205" text-anchor="middle" font-family="monospace" font-size="14" font-weight="700" fill="#0f172a">${escapeXml(ref)}</text>
  <text x="320" y="228" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#64748b">Mapped GIS Parcel</text>
</svg>`;
    return new NextResponse(emptySvg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const ring: Array<[number, number]> = latLngs.map(([lat, lng]) => [lng, lat]);
  const areaSqm = computeGeodesicAreaSqm(ring);
  const areaLabel = formatArea(areaSqm);

  const isRevoked = status === 'REVOKED';
  const isUnverified = status === 'UNVERIFIED';
  const strokeColor = isRevoked ? '#dc2626' : isUnverified ? '#d97706' : '#047857';
  const fillColor = isRevoked ? '#ef4444' : isUnverified ? '#f59e0b' : '#10b981';

  const polyPoints = scene.points.map((p) => `${p.x},${p.y}`).join(' ');
  const verticesMarkup = scene.points
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#ffffff" stroke="${strokeColor}" stroke-width="2.5"/>`,
    )
    .join('\n    ');

  const gridLines: string[] = [];
  for (let x = 40; x < width; x += 40) {
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#cbd5e1" stroke-width="0.7" stroke-dasharray="3 4"/>`);
  }
  for (let y = 40; y < height; y += 40) {
    gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#cbd5e1" stroke-width="0.7" stroke-dasharray="3 4"/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#ecfdf5"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  ${gridLines.join('\n  ')}
  <polygon points="${polyPoints}" fill="${fillColor}" fill-opacity="0.24" stroke="${strokeColor}" stroke-width="3" stroke-linejoin="round"/>
  ${verticesMarkup}
  <circle cx="${scene.centroidPoint.x}" cy="${scene.centroidPoint.y}" r="5.5" fill="${strokeColor}" stroke="#ffffff" stroke-width="2"/>
  <g transform="translate(592, 34)">
    <circle r="18" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1" stroke-width="1"/>
    <path d="M0 -11 L4 4 L0 0 L-4 4 Z" fill="${strokeColor}"/>
    <text x="0" y="13" text-anchor="middle" font-family="monospace" font-size="8" font-weight="700" fill="#475569">N</text>
  </g>
  <g transform="translate(16, ${height - 54})">
    <rect width="340" height="38" rx="6" fill="#0f172a" fill-opacity="0.86"/>
    <text x="12" y="16" font-family="monospace" font-size="11" font-weight="700" fill="#ffffff">${escapeXml(ref)} · ${escapeXml(areaLabel)}</text>
    <text x="12" y="30" font-family="monospace" font-size="10" fill="#a7f3d0">${scene.centroid.lat.toFixed(5)}, ${scene.centroid.lon.toFixed(5)} · Z${scene.zoom}</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
