import { formatArea } from '../../lib/gis-utils';

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
  isLoading: boolean;
  onClose: () => void;
}

export default function ParcelInfoPanel({ result, isLoading, onClose }: Props) {
  if (!result && !isLoading) return null;
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 w-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800">Verification Results</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
      </div>
      {isLoading ? (
        <p className="text-gray-500">Verifying parcel...</p>
      ) : result ? (
        <div className="space-y-2 text-sm">
          <div className={`p-2 rounded font-semibold ${result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {result.passed ? '✓ PASSED' : '✗ FAILED'}
          </div>
          <div><span className="text-gray-500">Geometry valid:</span> <span className={result.isValidGeometry ? 'text-green-600' : 'text-red-600'}>{result.isValidGeometry ? 'Yes' : 'No'}</span></div>
          <div><span className="text-gray-500">Self-intersecting:</span> <span className={result.isSelfIntersecting ? 'text-red-600' : 'text-green-600'}>{result.isSelfIntersecting ? 'Yes' : 'No'}</span></div>
          <div><span className="text-gray-500">Overlap detected:</span> <span className={result.overlapDetected ? 'text-red-600' : 'text-green-600'}>{result.overlapDetected ? 'Yes' : 'No'}</span></div>
          <div><span className="text-gray-500">Area:</span> <span className="font-medium">{formatArea(result.areaSqm)}</span></div>
          <div><span className="text-gray-500">Centroid:</span> <span className="font-mono text-xs">{result.centroid.lat.toFixed(6)}, {result.centroid.lon.toFixed(6)}</span></div>
          {result.overlappingParcels.length > 0 && (
            <div>
              <p className="text-gray-500 font-medium">Overlapping parcels:</p>
              <ul className="mt-1 space-y-1">
                {result.overlappingParcels.map(p => (
                  <li key={p.id} className="text-xs bg-red-50 p-1 rounded">{p.parcelNumber} ({formatArea(p.overlapAreaSqm)})</li>
                ))}
              </ul>
            </div>
          )}
          {result.errorDetails && (
            <div className="text-red-600 text-xs">{result.errorDetails}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
