import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">404 — Page Not Found</h1>
      <p className="text-gray-600 mb-6">The requested page could not be found.</p>
      <Link
        href="/"
        className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
      >
        Return Home
      </Link>
    </main>
  );
}
