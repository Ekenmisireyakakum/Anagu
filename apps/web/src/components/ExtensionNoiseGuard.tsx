'use client';

import { useEffect } from 'react';

export default function ExtensionNoiseGuard() {
  useEffect(() => {
    const isMetaMaskExtensionError = (reason: unknown, filename?: string): boolean => {
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
          ? reason
          : String((reason as { message?: unknown })?.message ?? reason ?? '');
      const stack = reason instanceof Error ? String(reason.stack ?? '') : '';
      const fromExtension =
        stack.includes('chrome-extension://') ||
        (filename ? filename.startsWith('chrome-extension://') : false);
      return fromExtension && msg.includes('Failed to connect to MetaMask');
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isMetaMaskExtensionError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (isMetaMaskExtensionError(event.error ?? event.message, event.filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection, true);
    window.addEventListener('error', handleError, true);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection, true);
      window.removeEventListener('error', handleError, true);
    };
  }, []);

  return null;
}
