'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatArea, getOpenStreetMapUrl } from '../../lib/gis-utils';

interface VerificationResult {
  id?: string;
  isValidGeometry: boolean;
  isSelfIntersecting: boolean;
  overlapDetected: boolean;
  overlappingParcels: Array<{ id: string; parcelNumber: string; overlapAreaSqm: number }>;
  areaSqm: number;
  centroid: { lat: number; lon: number };
  errorDetails: string | null;
  passed: boolean;
}

interface Props {
  result: VerificationResult | null;
  drawnWkt?: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export default function ParcelInfoPanel({ result, drawnWkt, isLoading, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!result && !isLoading) return null;

  const handleCopyWkt = async () => {
    if (!drawnWkt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(drawnWkt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <div className="absolute top-16 sm:top-4 right-4 z-[1000] bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-80 max-w-[calc(100vw-2rem)]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-slate-900">OpenStreetMap Spatial Check</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close verification results"
          className="text-slate-400 hover:text-slate-700 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
      {isLoading ? (
        <p className="text-xs text-slate-500">Verifying drawn polygon against Lagos registry...</p>
      ) : result ? (
        <div className="space-y-2 text-xs">
          <div
            className={`p-2 rounded font-semibold ${
              result.passed ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            {result.passed ? '✓ PASSED · Clear for Registration' : '✗ FAILED · Encroachment / Invalidity'}
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Geometry valid</span>
            <span className={result.isValidGeometry ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
              {result.isValidGeometry ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Self-intersecting</span>
            <span className={result.isSelfIntersecting ? 'text-red-700 font-medium' : 'text-emerald-700 font-medium'}>
              {result.isSelfIntersecting ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Overlap detected</span>
            <span className={result.overlapDetected ? 'text-red-700 font-medium' : 'text-emerald-700 font-medium'}>
              {result.overlapDetected ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Area</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">
              {formatArea(result.areaSqm)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Centroid</span>
            <span className="font-mono text-[11px] text-slate-700 tabular-nums">
              {result.centroid.lat.toFixed(6)}, {result.centroid.lon.toFixed(6)}
            </span>
          </div>

          {result.overlappingParcels.length > 0 && (
            <div className="pt-1">
              <p className="text-slate-600 font-medium mb-1">Overlapping parcels:</p>
              <ul className="space-y-1">
                {result.overlappingParcels.map((p) => (
                  <li key={p.id} className="text-[11px] font-mono bg-red-50 text-red-900 border border-red-200 px-2 py-1 rounded">
                    {p.parcelNumber} ({formatArea(p.overlapAreaSqm)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.errorDetails && (
            <div className="text-red-700 text-[11px]">{result.errorDetails}</div>
          )}

          <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
            {drawnWkt && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWkt}
                  className="flex-1 py-1.5 px-2.5 text-[11px] font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 whitespace-nowrap"
                >
                  {copied ? 'Copied WKT' : 'Copy WKT'}
                </button>
                <Link
                  href={`/register-land?wkt=${encodeURIComponent(drawnWkt)}`}
                  className="flex-1 py-1.5 px-2.5 text-center text-[11px] font-semibold text-white bg-emerald-700 rounded hover:bg-emerald-800 whitespace-nowrap"
                >
                  Register Plot →
                </Link>
              </div>
            )}
            <a
              href={getOpenStreetMapUrl(result.centroid.lat, result.centroid.lon, 17)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-emerald-700 hover:underline"
            >
              Open Location in OpenStreetMap →
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
