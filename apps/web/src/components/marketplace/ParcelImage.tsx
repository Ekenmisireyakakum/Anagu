'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ParcelImageProps {
  src: string;
  alt: string;
  parcelReference: string;
  lga: string;
  className?: string;
}

export default function ParcelImage({
  src,
  alt,
  parcelReference,
  lga,
  className = '',
}: ParcelImageProps) {
  const [failed, setFailed] = useState(false);

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
        <span className="text-[11px] text-slate-500 mt-0.5">{lga}, Lagos State</span>
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
