'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeMercatorParcelScene,
  extractWktFromParcelImageUrl,
  isDefaultParcelPlaceholder,
} from '../../lib/gis-utils';

interface ParcelImageProps {
  src?: string;
  alt: string;
  parcelReference: string;
  lga: string;
  wkt?: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
  status?: string;
  showMapBadge?: boolean;
  className?: string;
}

export default function ParcelImage({
  src = '',
  alt,
  parcelReference,
  lga,
  wkt,
  verificationStatus,
  status,
  showMapBadge = true,
  className = '',
}: ParcelImageProps) {
  const [failed, setFailed] = useState(false);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number }>({
    width: 440,
    height: 300,
  });

  const effectiveWkt = useMemo(() => {
    if (wkt && wkt.trim()) return wkt.trim();
    return extractWktFromParcelImageUrl(src) || '';
  }, [src, wkt]);

  const hasCustomUploadedImage = Boolean(src && !isDefaultParcelPlaceholder(src) && !failed);
  const shouldRenderMappedLand = Boolean(effectiveWkt) && !hasCustomUploadedImage;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (!shouldRenderMappedLand) return;
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.max(240, Math.round(rect.width));
      const nextH = Math.max(160, Math.round(rect.height));
      setDims((prev) =>
        Math.abs(prev.width - nextW) > 8 || Math.abs(prev.height - nextH) > 8
          ? { width: nextW, height: nextH }
          : prev,
      );
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldRenderMappedLand]);

  const scene = useMemo(() => {
    if (!shouldRenderMappedLand || !effectiveWkt) return null;
    return computeMercatorParcelScene(effectiveWkt, dims.width, dims.height);
  }, [dims.height, dims.width, effectiveWkt, shouldRenderMappedLand]);

  if (shouldRenderMappedLand && scene) {
    const isRevoked = status === 'REVOKED';
    const isUnverified = verificationStatus === 'UNVERIFIED';
    const strokeColor = isRevoked ? '#dc2626' : isUnverified ? '#d97706' : '#047857';
    const fillColor = isRevoked ? '#ef4444' : isUnverified ? '#f59e0b' : '#10b981';
    const polyPoints = scene.points.map((p) => `${p.x},${p.y}`).join(' ');

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden bg-slate-100 select-none ${className}`}
        role="img"
        aria-label={alt || `Mapped GIS boundary for ${parcelReference}`}
      >
        {/* Subtle cadastral grid backdrop if tiles are still loading or offline */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={`cadastral-grid-${parcelReference.replace(/[^a-zA-Z0-9]/g, '')}`}
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
            </pattern>
          </defs>
          <rect
            width={scene.width}
            height={scene.height}
            fill={`url(#cadastral-grid-${parcelReference.replace(/[^a-zA-Z0-9]/g, '')})`}
          />
        </svg>

        {/* OpenStreetMap Web Mercator tiles aligned to the exact parcel location */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {scene.tiles.map((tile) =>
            failedTiles[tile.key] ? null : (
              <Image
                key={tile.key}
                src={tile.url}
                alt=""
                width={256}
                height={256}
                unoptimized
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedTiles((prev) =>
                    prev[tile.key] ? prev : { ...prev, [tile.key]: true },
                  )
                }
                style={{
                  left: `${tile.left}px`,
                  top: `${tile.top}px`,
                  width: '256px',
                  height: '256px',
                }}
                className="absolute max-w-none pointer-events-none"
              />
            ),
          )}
        </div>

        {/* Soft contrast veil so the mapped boundary stands out clearly */}
        <div className="absolute inset-0 bg-slate-900/5 pointer-events-none" />

        {/* Exact mapped polygon + corner markers + center pin */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          aria-hidden="true"
        >
          <polygon
            points={polyPoints}
            fill={fillColor}
            fillOpacity={0.28}
            stroke="#ffffff"
            strokeWidth={4.5}
            strokeLinejoin="round"
          />
          <polygon
            points={polyPoints}
            fill={fillColor}
            fillOpacity={0.22}
            stroke={strokeColor}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {scene.points.map((pt, idx) => (
            <circle
              key={`${pt.x}-${pt.y}-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={3.5}
              fill="#ffffff"
              stroke={strokeColor}
              strokeWidth={2}
            />
          ))}
          <circle
            cx={scene.centroidPoint.x}
            cy={scene.centroidPoint.y}
            r={5}
            fill={strokeColor}
            stroke="#ffffff"
            strokeWidth={2}
          />
        </svg>

        {showMapBadge && (
          <div className="absolute left-2.5 bottom-2.5 right-2.5 flex items-end justify-between gap-2 pointer-events-none">
            <div className="px-2 py-1 rounded bg-slate-900/80 backdrop-blur-sm text-[10px] font-mono text-white leading-tight truncate max-w-[80%]">
              <span className="font-semibold text-emerald-300">GIS MAPPED</span> ·{' '}
              {scene.centroid.lat.toFixed(4)}, {scene.centroid.lon.toFixed(4)}
            </div>
            <span className="px-1.5 py-0.5 rounded bg-white/90 border border-slate-300 text-[9px] font-mono font-semibold text-slate-700 shrink-0">
              OSM Z{scene.zoom}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (failed || !src) {
    return (
      <div
        className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 flex flex-col items-center justify-center p-4 text-center ${className}`}
      >
        <svg
          className="w-10 h-10 text-emerald-700/60 mb-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
          />
        </svg>
        <span className="font-mono text-xs font-semibold text-slate-800">{parcelReference}</span>
        <span className="text-[11px] text-slate-500 mt-0.5">{lga}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes="(max-width: 768px) 100vw, 50vw"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    </div>
  );
}
