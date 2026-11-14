'use client';
import dynamic from 'next/dynamic';

const GisMap = dynamic(() => import('../../components/map/GisMap'), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center">
      <p>Loading map...</p>
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="h-screen">
      <GisMap />
    </div>
  );
}
