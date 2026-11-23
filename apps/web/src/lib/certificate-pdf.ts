'use client';

import QRCode from 'qrcode';
import type { DigitalLandTitle } from '../components/dashboard/types';
import { getPolygonExplorerTxUrl } from './polygon-config';

const A4_WIDTH_PX = 1654; // 200 DPI A4 portrait
const A4_HEIGHT_PX = 2339;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

function sanitizeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'PARCEL';
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let linesDrawn = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + linesDrawn * lineHeight);
      linesDrawn++;
      line = words[i];
      if (linesDrawn >= maxLines - 1) {
        let remaining = [line, ...words.slice(i + 1)].join(' ');
        while (remaining.length > 4 && ctx.measureText(`${remaining}...`).width > maxWidth) {
          remaining = remaining.slice(0, -1);
        }
        ctx.fillText(
          ctx.measureText(remaining).width > maxWidth ? `${remaining}...` : remaining,
          x,
          y + linesDrawn * lineHeight,
        );
        return y + (linesDrawn + 1) * lineHeight;
      }
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, y + linesDrawn * lineHeight);
    linesDrawn++;
  }
  return y + linesDrawn * lineHeight;
}

function drawTruncatedMono(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  let out = text;
  if (ctx.measureText(out).width > maxWidth) {
    while (out.length > 8 && ctx.measureText(`${out}...`).width > maxWidth) {
      out = out.slice(0, -1);
    }
    out = `${out}...`;
  }
  ctx.fillText(out, x, y);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function getCertificateVerificationUrl(title: DigitalLandTitle): string {
  if (/^0x[0-9a-fA-F]{64}$/.test(title.txHash)) {
    return getPolygonExplorerTxUrl(title.txHash);
  }
  return `ANAGU|TOKEN:#${title.tokenId}|PARCEL:${title.parcelReference}|OWNER:${title.ownerAddress}|TX:${title.txHash}`;
}

export async function renderCertificateCanvas(title: DigitalLandTitle): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = A4_WIDTH_PX;
  canvas.height = A4_HEIGHT_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize certificate rendering context');
  }

  // Crisp ivory-white official certificate sheet
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_WIDTH_PX, A4_HEIGHT_PX);

  // Subtle parchment border band
  ctx.strokeStyle = title.isRevoked ? '#991b1b' : '#065f46';
  ctx.lineWidth = 10;
  ctx.strokeRect(56, 56, A4_WIDTH_PX - 112, A4_HEIGHT_PX - 112);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(76, 76, A4_WIDTH_PX - 152, A4_HEIGHT_PX - 152);

  // Top Header Band
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(78, 78, A4_WIDTH_PX - 156, 265);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(78, 343);
  ctx.lineTo(A4_WIDTH_PX - 78, 343);
  ctx.stroke();

  // Official Registry Seal Emblem (left of masthead)
  const sealCx = 178;
  const sealCy = 210;
  ctx.strokeStyle = title.isRevoked ? '#991b1b' : '#065f46';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(sealCx, sealCy, 62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sealCx, sealCy, 50, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = title.isRevoked ? '#991b1b' : '#065f46';
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('ANAGU', sealCx, sealCy + 4);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('CADASTRE', sealCx, sealCy + 24);

  // Masthead Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('ANAGU DIGITAL LAND REGISTRY · POLYGON ERC-721 CADASTRE', 274, 152);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('Digital Certificate of Land Title', 274, 214);

  ctx.fillStyle = '#334155';
  ctx.font = '500 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    `Certificate No. ANAGU-ERC721-${title.tokenId}  ·  Parcel ${title.parcelReference}`,
    274,
    262,
  );

  ctx.fillStyle = title.isRevoked ? '#b91c1c' : '#047857';
  ctx.font = 'bold 22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    title.isRevoked
      ? 'STATUS: REVOKED (SECTION 28 LAND USE ACT)'
      : 'STATUS: ACTIVE VERIFIED DIGITAL LAND TITLE',
    274,
    304,
  );

  // QR Verification Block (top right inside body)
  const verifyPayload = getCertificateVerificationUrl(title);
  const qrDataUrl = await QRCode.toDataURL(verifyPayload, {
    width: 220,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  const qrImg = await loadImage(qrDataUrl);

  const qrBoxX = A4_WIDTH_PX - 340;
  const qrBoxY = 382;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.fillRect(qrBoxX, qrBoxY, 224, 278);
  ctx.strokeRect(qrBoxX, qrBoxY, 224, 278);
  ctx.drawImage(qrImg, qrBoxX + 12, qrBoxY + 12, 200, 200);
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.font = '600 17px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('SCAN TO VERIFY', qrBoxX + 112, qrBoxY + 236);
  ctx.font = '15px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Token #${title.tokenId}`, qrBoxX + 112, qrBoxY + 260);
  ctx.textAlign = 'left';

  // Section 1: Registered Proprietor & Property Details
  let cursorY = 408;
  const leftX = 116;
  const contentMaxWidth = qrBoxX - leftX - 48;

  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('1. Registered Proprietor & Parcel Schedule', leftX, cursorY);
  cursorY += 18;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftX, cursorY);
  ctx.lineTo(leftX + contentMaxWidth, cursorY);
  ctx.stroke();
  cursorY += 42;

  const drawField = (label: string, value: string, yPos: number, mono = false): number => {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, leftX, yPos);
    ctx.fillStyle = '#0f172a';
    ctx.font = mono
      ? '500 22px ui-monospace, SFMono-Regular, Menlo, monospace'
      : '600 26px system-ui, -apple-system, sans-serif';
    return drawWrappedText(ctx, value, leftX, yPos + 32, contentMaxWidth, 34, 2) + 22;
  };

  cursorY = drawField('Registered Legal Owner', title.ownerName, cursorY);
  cursorY = drawField('Owner Web3 Wallet Address (Polygon)', title.ownerAddress, cursorY, true);
  cursorY = drawField(
    'Parcel Location & Address',
    `${title.address}, ${title.lga}, ${title.state}`,
    cursorY,
  );

  // Two-column numeric summary row
  const col2X = leftX + 460;
  ctx.fillStyle = '#64748b';
  ctx.font = '600 19px system-ui, -apple-system, sans-serif';
  ctx.fillText('Surveyed Land Area', leftX, cursorY);
  ctx.fillText('Ledger Block & Issued Date', col2X, cursorY);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`${title.areaSqm.toLocaleString('en-US')} m²`, leftX, cursorY + 32);
  ctx.fillText(
    `Block #${title.blockNumber} · ${new Date(title.issuedAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`,
    col2X,
    cursorY + 32,
  );
  cursorY += 86;

  // Section 2: Cryptographic Hashes & Blockchain Settlement
  const fullWidth = A4_WIDTH_PX - leftX * 2;
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('2. Cryptographic Verification & On-Chain Settlement', leftX, cursorY);
  cursorY += 18;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(leftX, cursorY);
  ctx.lineTo(leftX + fullWidth, cursorY);
  ctx.stroke();
  cursorY += 26;

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#e2e8f0';
  ctx.fillRect(leftX, cursorY, fullWidth, 270);
  ctx.strokeRect(leftX, cursorY, fullWidth, 270);

  const hashRows: Array<[string, string]> = [
    ['ERC-721 Token ID', `#${title.tokenId} (Parcel ID: ${title.parcelId})`],
    ['Settlement Tx Hash', title.txHash],
    ['Spatial Boundary Hash (SHA-256)', title.spatialHash],
    ['Owner Reference Hash', title.ownerReferenceHash],
    ['Registered Deed Document Hash', title.documentHash],
  ];

  let hashY = cursorY + 42;
  for (const [k, v] of hashRows) {
    ctx.fillStyle = '#475569';
    ctx.font = '600 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(k, leftX + 24, hashY);
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 19px ui-monospace, SFMono-Regular, Menlo, monospace';
    drawTruncatedMono(ctx, v, leftX + 380, hashY, fullWidth - 404);
    hashY += 48;
  }
  cursorY += 316;

  // Section 3: Chain of Title History
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('3. Chain of Title & Ownership Transfers', leftX, cursorY);
  cursorY += 18;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(leftX, cursorY);
  ctx.lineTo(leftX + fullWidth, cursorY);
  ctx.stroke();
  cursorY += 38;

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(leftX, cursorY - 26, fullWidth, 42);
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('Action', leftX + 16, cursorY);
  ctx.fillText('Owner / Recipient', leftX + 185, cursorY);
  ctx.fillText('Wallet', leftX + 540, cursorY);
  ctx.fillText('Date', leftX + 830, cursorY);
  ctx.fillText('Transaction Ref', leftX + 1090, cursorY);
  cursorY += 42;

  const entries = title.ownershipHistory.slice(-6);
  for (const entry of entries) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(entry.action, leftX + 16, cursorY);

    ctx.font = '500 19px system-ui, -apple-system, sans-serif';
    drawTruncatedMono(ctx, entry.toName, leftX + 185, cursorY, 335);

    ctx.font = '18px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText(
      entry.toAddress.length > 16
        ? `${entry.toAddress.slice(0, 8)}...${entry.toAddress.slice(-6)}`
        : entry.toAddress,
      leftX + 540,
      cursorY,
    );
    ctx.fillText(
      new Date(entry.timestamp).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      leftX + 830,
      cursorY,
    );
    ctx.fillText(
      entry.txHash.length > 18 ? `${entry.txHash.slice(0, 16)}...` : entry.txHash,
      leftX + 1090,
      cursorY,
    );

    cursorY += 16;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(leftX, cursorY);
    ctx.lineTo(leftX + fullWidth, cursorY);
    ctx.stroke();
    cursorY += 34;
  }

  // Revocation Notice if revoked
  if (title.isRevoked) {
    cursorY += 14;
    ctx.fillStyle = '#fef2f2';
    ctx.strokeStyle = '#fecaca';
    ctx.fillRect(leftX, cursorY, fullWidth, 128);
    ctx.strokeRect(leftX, cursorY, fullWidth, 128);
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `SECTION 28 STATUTORY REVOCATION NOTICE · Gazette: ${title.revocationReference || 'N/A'}`,
      leftX + 20,
      cursorY + 38,
    );
    ctx.font = '18px system-ui, -apple-system, sans-serif';
    drawWrappedText(
      ctx,
      `Ground: ${title.revocationGrounds || 'Public Interest'} — ${title.revocationJustification || ''}`,
      leftX + 20,
      cursorY + 72,
      fullWidth - 40,
      28,
      2,
    );
  }

  // Footer Attestation
  const footerY = A4_HEIGHT_PX - 230;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftX, footerY);
  ctx.lineTo(leftX + fullWidth, footerY);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('ANAGU Digital Land Registry Attestation', leftX, footerY + 42);

  ctx.fillStyle = '#475569';
  ctx.font = '18px system-ui, -apple-system, sans-serif';
  drawWrappedText(
    ctx,
    'Issued by the ANAGU Geospatial Land Cadastre & Polygon ERC-721 Title Ledger. This digital certificate verifies the recorded token holder, spatial polygon boundary hash, and deed provenance on record. Statutory Certificates of Occupancy remain subject to applicable state land administration.',
    leftX,
    footerY + 76,
    fullWidth,
    28,
    3,
  );

  ctx.fillStyle = '#64748b';
  ctx.font = '16px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    `Generated: ${new Date().toISOString()} · ANAGU Title #${title.tokenId}`,
    leftX,
    A4_HEIGHT_PX - 92,
  );

  return canvas;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeAscii(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

function buildSingleImagePdf(jpegBytes: Uint8Array, widthPx: number, heightPx: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const pushStr = (text: string) => pushBytes(encodeAscii(text));

  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // 1: Catalog
  offsets.push(byteLength);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  offsets.push(byteLength);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: Page
  offsets.push(byteLength);
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  // 4: JPEG XObject
  offsets.push(byteLength);
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  // 5: Page Content Stream
  const contentStream = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets.push(byteLength);
  pushStr(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = byteLength;
  pushStr(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const merged = new Uint8Array(byteLength);
  let pos = 0;
  for (const chunk of chunks) {
    merged.set(chunk, pos);
    pos += chunk.length;
  }
  return merged;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadCertificatePdf(title: DigitalLandTitle): Promise<void> {
  const canvas = await renderCertificateCanvas(title);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = jpegDataUrl.split(',')[1];
  const jpegBytes = base64ToUint8Array(base64);
  const pdfBytes = buildSingleImagePdf(jpegBytes, canvas.width, canvas.height);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const filename = `ANAGU-Land-Title-${title.tokenId}-${sanitizeFileSegment(title.parcelReference)}.pdf`;
  triggerBlobDownload(blob, filename);
}

export async function downloadCertificatePng(title: DigitalLandTitle): Promise<void> {
  const canvas = await renderCertificateCanvas(title);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), 'image/png'),
  );
  if (!blob) {
    throw new Error('Unable to export certificate PNG image');
  }
  const filename = `ANAGU-Land-Title-${title.tokenId}-${sanitizeFileSegment(title.parcelReference)}.png`;
  triggerBlobDownload(blob, filename);
}
