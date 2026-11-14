import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">ANAGU Land Administration</h1>
        <p className="text-lg text-gray-600 mb-8">Blockchain-based land title management platform for Nigeria</p>
        <Link href="/map" className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors">
          Open GIS Map
        </Link>
      </div>
    </main>
  );
}
