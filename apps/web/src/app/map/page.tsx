'use client';
import { useEffect, useState, type ComponentType } from 'react';
import SiteHeader from '../../components/SiteHeader';

export default function MapPage() {
  const [GisMap, setGisMap] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;
    import('../../components/map/GisMap').then((mod) => {
      if (active) {
        setGisMap(() => mod.default);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <div className="flex-1 h-[calc(100dvh-64px)] min-h-[480px]">
        {!GisMap ? (
          <div className="h-full flex items-center justify-center p-4 text-sm text-slate-600 text-center">
            Loading interactive GIS land map...
          </div>
        ) : (
          <GisMap />
        )}
      </div>
    </div>
  );
}
