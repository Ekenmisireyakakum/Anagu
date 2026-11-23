import type { Metadata } from 'next';
import Script from 'next/script';
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

const EARLY_EXTENSION_GUARD = `
(function(){
  if (typeof window === 'undefined' || window.__anaguExtGuardInstalled) return;
  window.__anaguExtGuardInstalled = true;
  function isExtNoise(reason, filename) {
    if (!reason && !filename) return false;
    var msg = typeof reason === 'string' ? reason : (reason && reason.message ? String(reason.message) : String(reason || ''));
    var stack = reason && typeof reason.stack === 'string' ? reason.stack : '';
    var combined = msg + ' ' + stack;
    var fromExt = stack.indexOf('chrome-extension://') !== -1 || stack.indexOf('moz-extension://') !== -1 || stack.indexOf('safari-extension://') !== -1 || (filename ? filename.indexOf('chrome-extension://') === 0 || filename.indexOf('moz-extension://') === 0 : false);
    return fromExt && (combined.indexOf('Failed to connect to MetaMask') !== -1 || combined.indexOf('Extension context invalidated') !== -1);
  }
  window.addEventListener('unhandledrejection', function(e) {
    if (isExtNoise(e.reason)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('error', function(e) {
    if (isExtNoise(e.error || e.message, e.filename)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
        <Script id="anagu-extension-guard" strategy="beforeInteractive">
          {EARLY_EXTENSION_GUARD}
        </Script>
        <ExtensionNoiseGuard />
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}

