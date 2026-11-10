/**
 * Zero-dependency pure-JS ZIP generator for bundling student QR PNG cards.
 * Implements standard PKZIP format in STORE (uncompressed) mode.
 */

// CRC32 table
const makeCrcTable = () => {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
};

const crcTable = makeCrcTable();

const crc32 = (buf: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

export const createZipBlob = (files: ZipFileInput[]): Blob => {
  const parts: Uint8Array[] = [];
  const centralDirHeaders: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const time =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const date =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const fileCrc = crc32(file.data);
    const size = file.data.length;

    // --- Local File Header (30 bytes + filename) ---
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local header signature
    lv.setUint16(4, 20, true);         // Version needed to extract (2.0)
    lv.setUint16(6, 0, true);          // General purpose bit flag
    lv.setUint16(8, 0, true);          // Compression method (0 = STORE)
    lv.setUint16(10, time, true);      // File time
    lv.setUint16(12, date, true);      // File date
    lv.setUint32(14, fileCrc, true);   // CRC32
    lv.setUint32(18, size, true);      // Compressed size
    lv.setUint32(22, size, true);      // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // Filename length
    lv.setUint16(28, 0, true);         // Extra field length
    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(file.data);

    // --- Central Directory Header (46 bytes + filename) ---
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true);         // Version made by
    cv.setUint16(6, 20, true);         // Version needed to extract
    cv.setUint16(8, 0, true);          // General purpose bit flag
    cv.setUint16(10, 0, true);         // Compression method (STORE)
    cv.setUint16(12, time, true);      // File time
    cv.setUint16(14, date, true);      // File date
    cv.setUint32(16, fileCrc, true);   // CRC32
    cv.setUint32(20, size, true);      // Compressed size
    cv.setUint32(24, size, true);      // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // Filename length
    cv.setUint16(30, 0, true);         // Extra field length
    cv.setUint16(32, 0, true);         // File comment length
    cv.setUint16(34, 0, true);         // Disk number start
    cv.setUint16(36, 0, true);         // Internal file attributes
    cv.setUint32(38, 0, true);         // External file attributes
    cv.setUint32(42, offset, true);    // Relative offset of local header
    cdHeader.set(nameBytes, 46);

    centralDirHeaders.push(cdHeader);
    offset += localHeader.length + size;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const cdh of centralDirHeaders) {
    parts.push(cdh);
    centralDirSize += cdh.length;
  }

  // --- End of Central Directory Record (22 bytes) ---
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);  // EOCD signature
  ev.setUint16(4, 0, true);           // Number of this disk
  ev.setUint16(6, 0, true);           // Disk with start of central directory
  ev.setUint16(8, files.length, true);// Total entries in central directory on this disk
  ev.setUint16(10, files.length, true);// Total entries in central directory
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, centralDirOffset, true);// Offset of start of central directory
  ev.setUint16(20, 0, true);          // Comment length

  parts.push(eocd);

  return new Blob(parts as any, { type: 'application/zip' });
};

