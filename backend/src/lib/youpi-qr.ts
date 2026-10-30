import qrcodeLib from './youpi-qr-lib';

const getQrCodeFn = (): any => {
  if (typeof qrcodeLib === 'function') return qrcodeLib;
  if (qrcodeLib && typeof (qrcodeLib as any).qrcode === 'function') return (qrcodeLib as any).qrcode;
  if (qrcodeLib && typeof (qrcodeLib as any).default === 'function') return (qrcodeLib as any).default;
  return qrcodeLib;
};

/**
 * Authentic ISO/IEC 18004 Standard QR Code Engine from YouPI-PG (packages/core/src/qr.js)
 * Produces 100% genuine scannable QR codes for all UPI apps (PhonePe, Google Pay, Paytm, BHIM).
 */
export class QrCode {
  /**
   * Generates a 2D binary matrix for the input text.
   * @param text string to encode
   * @param errorCorrection 'L' | 'M' | 'Q' | 'H'
   * @returns 2D matrix (1 = dark, 0 = light)
   */
  static encode(text: string, errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'M'): number[][] {
    const qrcode = getQrCodeFn();
    const qr = qrcode(0, errorCorrection);
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const matrix: number[][] = [];
    for (let r = 0; r < count; r++) {
      const row: number[] = [];
      for (let c = 0; c < count; c++) {
        row.push(qr.isDark(r, c) ? 1 : 0);
      }
      matrix.push(row);
    }
    return matrix;
  }
}

/**
 * Generates valid, crisp SVG markup for an authentic QR Code directly using YouPI-PG's native engine.
 * Generates only the clean square vector QR with white rounded background and dark modules.
 * Absolutely NO full PhonePe poster, NO center logos, NO promotional graphics.
 *
 * @param text The UPI payload URI string
 * @param boxSize ViewBox dimension in pixels (default 240)
 * @param errorCorrection Error correction level ('L'|'M'|'Q'|'H', default 'M')
 * @returns Complete SVG string
 */
export function generateQrSvg(
  text: string,
  boxSize: number = 240,
  errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'M'
): string {
  const matrix = QrCode.encode(text, errorCorrection);
  const numModules = matrix.length;
  const moduleSize = boxSize / numModules;

  let rects = '';
  for (let r = 0; r < numModules; r++) {
    for (let c = 0; c < numModules; c++) {
      if (matrix[r][c] === 1) {
        const x = (c * moduleSize).toFixed(2);
        const y = (r * moduleSize).toFixed(2);
        const s = (moduleSize + 0.05).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#0f172a" />\n`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boxSize} ${boxSize}" width="100%" height="100%" shape-rendering="crispEdges">
  <rect width="${boxSize}" height="${boxSize}" fill="#ffffff" rx="8" />
  ${rects}
</svg>`;
}

export const generateQrMatrix = (text: string, errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'M') =>
  QrCode.encode(text, errorCorrection);

export interface BuildUpiUriOptions {
  payeeVpa: string;
  payeeName: string;
  amountPaise?: number | bigint;
  amountRupees?: number | string;
  transactionRef?: string;
  transactionNote?: string;
  currency?: string;
}

/**
 * Builds a canonical upi://pay URI dynamically from server-validated parameters,
 * matching YouPI-PG's packages/common/src/upi.js specifications.
 */
export function buildCanonicalUpiUri(options: BuildUpiUriOptions): string {
  const vpa = (options.payeeVpa || '').trim();
  const name = (options.payeeName || 'Lakshya Smart Library').trim();
  let amountStr = '500.00';
  if (options.amountRupees) {
    amountStr = Number(options.amountRupees).toFixed(2);
  } else if (options.amountPaise) {
    amountStr = (Number(options.amountPaise) / 100).toFixed(2);
  }

  const params = new URLSearchParams();
  params.set('pa', vpa);
  params.set('pn', name);
  params.set('am', amountStr);
  params.set('cu', options.currency || 'INR');

  const note = (options.transactionNote || 'Lakshya Smart Library Membership').trim();
  if (note) {
    params.set('tn', note);
  }

  const ref = (options.transactionRef || '').trim();
  if (ref) {
    params.set('tr', ref);
  }

  return `upi://pay?${params.toString()}`;
}
