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
  title: 'ANAGU — Land Administration & Blockchain Title Registry',
  description:
    'Blockchain-based land administration framework for Nigeria combining PostGIS spatial verification, institutional & community ownership oracles, Hyperledger Besu ERC-721 titles, and statutory revocation.',
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
