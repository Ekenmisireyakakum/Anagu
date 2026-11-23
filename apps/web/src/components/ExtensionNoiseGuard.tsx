'use client';

import { useEffect } from 'react';

function isMetaMaskExtensionError(reason: unknown, filename?: string): boolean {
  if (!reason && !filename) return false;
  const obj = reason as { message?: unknown; stack?: unknown; name?: unknown } | null;
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
      ? reason
      : String(obj?.message ?? reason ?? '');
  const stack =
    reason instanceof Error
      ? String(reason.stack ?? '')
      : typeof obj?.stack === 'string'
      ? obj.stack
      : '';
  const combined = `${msg} ${stack}`;
  const fromExtension =
    stack.includes('chrome-extension://') ||
    stack.includes('moz-extension://') ||
    stack.includes('safari-extension://') ||
    (filename
      ? filename.startsWith('chrome-extension://') ||
        filename.startsWith('moz-extension://') ||
        filename.startsWith('safari-extension://')
      : false);
  return (
    fromExtension &&
    (combined.includes('Failed to connect to MetaMask') ||
      combined.includes('Extension context invalidated'))
  );
}

function installExtensionNoiseGuard(): void {
  if (typeof window === 'undefined') return;
  const win = window as Window & { __anaguExtGuardInstalled?: boolean };
  if (win.__anaguExtGuardInstalled) return;
  win.__anaguExtGuardInstalled = true;

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
}

if (typeof window !== 'undefined') {
  installExtensionNoiseGuard();
}

export default function ExtensionNoiseGuard() {
  useEffect(() => {
    installExtensionNoiseGuard();
  }, []);

  return null;
}

