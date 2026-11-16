'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-600 mb-6">{error.message || 'An unexpected error occurred.'}</p>
      <button
        onClick={() => reset()}
        className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
      >
        Try again
      </button>
    </main>
  );
}
