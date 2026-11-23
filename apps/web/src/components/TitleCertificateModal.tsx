'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  downloadCertificatePdf,
  downloadCertificatePng,
  getCertificateVerificationUrl,
} from '../lib/certificate-pdf';
import { getPolygonExplorerTxUrl } from '../lib/polygon-config';
import type { DigitalLandTitle } from './dashboard/types';

interface TitleCertificateModalProps {
  title: DigitalLandTitle | null;
  onClose: () => void;
}

function CertificateDocumentSheet({
  title,
  qrDataUrl,
}: {
  title: DigitalLandTitle;
  qrDataUrl: string | null;
}) {
  const hasOnChainTx = /^0x[0-9a-fA-F]{64}$/.test(title.txHash);

  return (
    <div
      className={`bg-white border-2 ${
        title.isRevoked ? 'border-red-800' : 'border-emerald-900'
      } rounded-sm p-5 sm:p-8 space-y-6 text-slate-900`}
    >
      {/* Official Masthead */}
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold tracking-wider text-slate-500">
            ANAGU DIGITAL LAND REGISTRY · POLYGON ERC-721 CADASTRE
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">
            Digital Certificate of Land Title
          </h2>
          <div className="text-xs font-mono text-slate-700 tabular-nums">
            Certificate No. ANAGU-ERC721-{title.tokenId} · Parcel {title.parcelReference}
          </div>
          <div
            className={`text-xs font-mono font-bold pt-0.5 ${
              title.isRevoked ? 'text-red-700' : 'text-emerald-800'
            }`}
          >
            {title.isRevoked
              ? 'STATUS: REVOKED (SECTION 28 LAND USE ACT)'
              : 'STATUS: ACTIVE VERIFIED DIGITAL TITLE'}
          </div>
        </div>

        {/* Scannable Verification QR */}
        <div className="shrink-0 flex flex-col items-center border border-slate-200 rounded p-2.5 bg-white self-start">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={`Verification QR code for Title #${title.tokenId}`}
              width={96}
              height={96}
              unoptimized
              className="w-24 h-24 object-contain"
            />
          ) : (
            <div className="w-24 h-24 bg-slate-100 flex items-center justify-center text-[10px] font-mono text-slate-500">
              QR Seal
            </div>
          )}
          <span className="mt-1 text-[10px] font-mono font-semibold text-slate-600 tabular-nums">
            Token #{title.tokenId}
          </span>
        </div>
      </div>

      {/* Section 1: Proprietor & Parcel Schedule */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wide text-emerald-900 border-b border-slate-200 pb-1.5">
          1. Registered Proprietor &amp; Parcel Schedule
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-slate-500">Registered Legal Owner</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{title.ownerName}</div>
          </div>
          <div>
            <div className="text-slate-500">Owner Web3 Wallet Address</div>
            <div className="mt-0.5 font-mono text-slate-900 break-all">{title.ownerAddress}</div>
          </div>
          <div>
            <div className="text-slate-500">Parcel Location &amp; Address</div>
            <div className="mt-0.5 font-medium text-slate-900">
              {title.address}, {title.lga}, {title.state}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-slate-500">Surveyed Area</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {title.areaSqm.toLocaleString('en-US')} m²
              </div>
            </div>
            <div>
              <div className="text-slate-500">Ledger Block &amp; Issue Date</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                #{title.blockNumber} ·{' '}
                {new Date(title.issuedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Cryptographic Hashes */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wide text-emerald-900 border-b border-slate-200 pb-1.5">
          2. Cryptographic Verification &amp; Settlement Hashes
        </h3>
        <dl className="bg-slate-50 border border-slate-200 rounded p-3.5 space-y-2 text-[11px] font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <dt className="text-slate-500 shrink-0">Settlement Tx Hash</dt>
            <dd className="text-slate-900 break-all flex items-center gap-2">
              <span>{title.txHash}</span>
              {hasOnChainTx && (
                <a
                  href={getPolygonExplorerTxUrl(title.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans font-semibold text-emerald-700 underline shrink-0 print:hidden"
                >
                  Polygonscan ↗
                </a>
              )}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <dt className="text-slate-500 shrink-0">Spatial Boundary Hash</dt>
            <dd className="text-slate-800 break-all">{title.spatialHash}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <dt className="text-slate-500 shrink-0">Owner Reference Hash</dt>
            <dd className="text-slate-800 break-all">{title.ownerReferenceHash}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <dt className="text-slate-500 shrink-0">Deed Document Hash</dt>
            <dd className="text-slate-800 break-all">{title.documentHash}</dd>
          </div>
        </dl>
      </div>

      {/* Section 3: Chain of Title History */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold tracking-wide text-emerald-900 border-b border-slate-200 pb-1.5">
          3. Chain of Title History ({title.ownershipHistory.length})
        </h3>
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Owner / Recipient</th>
                <th className="px-3 py-2 font-semibold">Wallet</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Tx Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {title.ownershipHistory.map((h, idx) => (
                <tr key={`${h.txHash}-${idx}`}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{h.action}</td>
                  <td className="px-3 py-2 font-sans text-slate-800">{h.toName}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {h.toAddress.length > 14
                      ? `${h.toAddress.slice(0, 8)}...${h.toAddress.slice(-4)}`
                      : h.toAddress}
                  </td>
                  <td className="px-3 py-2 text-slate-600 tabular-nums">
                    {new Date(h.timestamp).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {h.txHash.length > 16 ? `${h.txHash.slice(0, 14)}...` : h.txHash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {title.isRevoked && (
        <div className="bg-red-50 border border-red-200 rounded p-3.5 text-xs text-red-900 space-y-1">
          <div className="font-semibold">
            Section 28 Statutory Revocation Notice · Gazette: {title.revocationReference}
          </div>
          <div>
            Revoked by {title.revokedByName} on{' '}
            {title.revokedAt ? new Date(title.revokedAt).toLocaleString() : 'record'} · Ground:{' '}
            {title.revocationGrounds}
          </div>
          <p>{title.revocationJustification}</p>
        </div>
      )}

      {/* Registry Attestation Footer */}
      <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-600 leading-relaxed space-y-1">
        <div className="font-semibold text-slate-900">
          ANAGU Digital Land Registry Attestation
        </div>
        <p>
          Issued by the ANAGU Geospatial Land Cadastre &amp; Polygon ERC-721 Title Ledger. This
          certificate confirms the recorded digital token holder, polygon boundary hash, and deed
          provenance on file. Statutory Certificates of Occupancy remain subject to applicable
          state land administration and gazetting.
        </p>
      </div>
    </div>
  );
}

export default function TitleCertificateModal({ title, onClose }: TitleCertificateModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<'pdf' | 'png' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!title) return;
    let active = true;
    setErrorMsg(null);
    QRCode.toDataURL(getCertificateVerificationUrl(title), {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [title]);

  useEffect(() => {
    if (!title) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, title]);

  if (!title) return null;

  const handleDownloadPdf = async () => {
    setBusyMode('pdf');
    setErrorMsg(null);
    try {
      await downloadCertificatePdf(title);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate PDF certificate');
    } finally {
      setBusyMode(null);
    }
  };

  const handleDownloadPng = async () => {
    setBusyMode('png');
    setErrorMsg(null);
    try {
      await downloadCertificatePng(title);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate PNG certificate');
    } finally {
      setBusyMode(null);
    }
  };

  const handlePrint = () => {
    if (typeof window === 'undefined') return;
    document.body.classList.add('anagu-printing-certificate');
    const cleanup = () => {
      document.body.classList.remove('anagu-printing-certificate');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Digital Land Title Certificate Token #${title.tokenId}`}
        className="fixed inset-0 z-[1500] bg-slate-900/60 backdrop-blur-[1px] flex items-start justify-center overflow-y-auto p-3 sm:p-6 print:hidden"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl bg-slate-50 border border-slate-300 rounded-lg shadow-2xl overflow-hidden my-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Toolbar */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Land Title Certificate · Token #{title.tokenId}
              </div>
              <div className="text-xs font-mono text-slate-500">
                {title.parcelReference} · {title.ownerName}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyMode !== null}
                onClick={() => void handleDownloadPdf()}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
              >
                {busyMode === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
              </button>
              <button
                type="button"
                disabled={busyMode !== null}
                onClick={() => void handleDownloadPng()}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
              >
                {busyMode === 'png' ? 'Exporting PNG...' : 'Download PNG'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 whitespace-nowrap"
              >
                Print Certificate
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                Close
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="mx-4 sm:mx-6 mt-4 p-3 rounded border border-red-200 bg-red-50 text-xs text-red-900">
              {errorMsg}
            </div>
          )}

          {/* Certificate Preview Sheet */}
          <div className="p-4 sm:p-6">
            <CertificateDocumentSheet title={title} qrDataUrl={qrDataUrl} />
          </div>
        </div>
      </div>

      {/* Dedicated Clean Print Portal */}
      {mounted &&
        createPortal(
          <div className="anagu-certificate-print-portal hidden print:block p-4 bg-white">
            <CertificateDocumentSheet title={title} qrDataUrl={qrDataUrl} />
          </div>,
          document.body,
        )}
    </>
  );
}
