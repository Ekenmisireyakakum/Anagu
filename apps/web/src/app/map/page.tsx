'use client';
import { useEffect, useState, type ComponentType } from 'react';
import AuthRequiredGate from '../../components/AuthRequiredGate';
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
    <AuthRequiredGate
      nextPath="/map"
      title="Log In or Sign Up to Open the GIS Map"
      description="Create an account or log in to view cadastral parcel layers, measure land boundaries, and verify spatial overlap."
      includeFooter
    >
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <main className="relative w-full h-[calc(100dvh-64px)] min-h-[520px] shrink-0">
          {!GisMap ? (
            <div className="h-full w-full flex items-center justify-center p-4 text-sm text-slate-600 text-center">
              Loading interactive GIS land map...
            </div>
          ) : (
            <GisMap />
          )}
        </main>
      </div>
    </AuthRequiredGate>
  );
}

