'use client';

import { useEffect, useState, type ComponentType } from 'react';
import type { OsmParcelMapProps } from './OsmParcelMapInner';

export default function OsmParcelMap(props: OsmParcelMapProps) {
  const [InnerMap, setInnerMap] = useState<ComponentType<OsmParcelMapProps> | null>(null);

  useEffect(() => {
    let active = true;
    import('./OsmParcelMapInner').then((mod) => {
      if (active) {
        setInnerMap(() => mod.default);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!InnerMap) {
    return (
      <div
        className={`w-full ${props.heightClassName || 'h-64'} border border-slate-200 rounded-md bg-slate-100 flex items-center justify-center text-xs text-slate-500`}
      >
        Loading OpenStreetMap parcel view...
      </div>
    );
  }

  return <InnerMap {...props} />;
}
