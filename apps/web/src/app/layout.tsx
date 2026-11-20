import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import ExtensionNoiseGuard from '../components/ExtensionNoiseGuard';
import { WalletProvider } from '../components/WalletContext';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ANAGU — GIS Land Mapping & Polygon Web3 Title Registry',
  description:
    'Map and register land locations interactively with GIS, verify parcels, and issue Polygon ERC-721 land titles with ERC-20 token settlement and simple Web3 wallet sign-up.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
        <ExtensionNoiseGuard />
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
