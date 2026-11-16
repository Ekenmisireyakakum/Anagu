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
      <div className="flex-1" style={{ height: 'calc(100vh - 64px)' }}>
        {!GisMap ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-600">
            Loading interactive Lagos GIS registry map...
          </div>
        ) : (
          <GisMap />
        )}
      </div>
    </div>
  );
}
