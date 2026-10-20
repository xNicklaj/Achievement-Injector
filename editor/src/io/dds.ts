// Just enough of DirectDraw Surface to check and preview achievement icons (HANDOVER 3.4):
// the game accepts BC3 (DXT5) and below, 512x512. BC4, BC5, BC6H and BC7 are not supported.

export type DdsFormat = "BC1" | "BC2" | "BC3" | "BC4" | "BC5" | "BC6H" | "BC7" | "RGBA8" | "BGRA8" | "unknown";

export type DdsInfo = {
  width: number;
  height: number;
  format: DdsFormat;
  /** The name a tool would show: DXT5 for BC3, and so on. */
  label: string;
  /** Usable by the game (BC1 to BC3). */
  supported: boolean;
  /** Things to tell the author: wrong size, unsupported format. Empty means fine. */
  problems: string[];
  /** Byte offset of the first (largest) image. */
  dataOffset: number;
};

export type DdsResult = { ok: true; info: DdsInfo } | { ok: false; error: string };

export const ICON_SIZE = 512;

const MAGIC = 0x20534444; // "DDS "
const fourCC = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

// DXGI_FORMAT values: BC1 70-72, BC2 73-75, BC3 76-78, BC4 79-81, BC5 82-84, BC6H 94-96, BC7 97-99.
const DXGI: [number, number, DdsFormat][] = [[70, 72, "BC1"], [73, 75, "BC2"], [76, 78, "BC3"], [79, 81, "BC4"], [82, 84, "BC5"], [94, 96, "BC6H"], [97, 99, "BC7"]];
const LABEL: Record<DdsFormat, string> = { BC1: "BC1 (DXT1)", BC2: "BC2 (DXT3)", BC3: "BC3 (DXT5)", BC4: "BC4", BC5: "BC5", BC6H: "BC6H", BC7: "BC7", RGBA8: "uncompressed RGBA", BGRA8: "uncompressed BGRA", unknown: "unknown format" };

export function parseDds(bytes: Uint8Array): DdsResult {
  if (bytes.length < 128) return { ok: false, error: "Not a DDS file (too short)." };
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0, true) !== MAGIC) return { ok: false, error: "Not a DDS file." };
  if (v.getUint32(4, true) !== 124) return { ok: false, error: "Unexpected DDS header size." };

  const height = v.getUint32(12, true);
  const width = v.getUint32(16, true);
  const pfFlags = v.getUint32(80, true);
  const cc = fourCC(bytes, 84);
  let format: DdsFormat = "unknown";
  let dataOffset = 128;

  if (cc === "DX10") {
    dataOffset += 20;
    if (bytes.length < dataOffset) return { ok: false, error: "Truncated DDS header." };
    const dxgi = v.getUint32(128, true);
    format = DXGI.find(([lo, hi]) => dxgi >= lo && dxgi <= hi)?.[2] ?? (dxgi === 28 || dxgi === 29 ? "RGBA8" : dxgi === 87 || dxgi === 91 ? "BGRA8" : "unknown");
  } else if (cc === "DXT1") format = "BC1";
  else if (cc === "DXT3") format = "BC2";
  else if (cc === "DXT5") format = "BC3";
  else if (cc === "ATI1" || cc === "BC4U" || cc === "BC4S") format = "BC4";
  else if (cc === "ATI2" || cc === "BC5U" || cc === "BC5S") format = "BC5";
  else if ((pfFlags & 0x40) !== 0 && v.getUint32(88, true) === 32) format = v.getUint32(92, true) === 0xff ? "RGBA8" : v.getUint32(92, true) === 0xff0000 ? "BGRA8" : "unknown";

  const supported = format === "BC1" || format === "BC2" || format === "BC3";
  const problems: string[] = [];
  if (!supported) problems.push(`${LABEL[format]} is not supported by the game: use BC3 (DXT5) or lower.`);
  if (width !== ICON_SIZE || height !== ICON_SIZE) problems.push(`Icons should be ${ICON_SIZE}×${ICON_SIZE}, this one is ${width}×${height}.`);
  return { ok: true, info: { width, height, format, label: LABEL[format], supported, problems, dataOffset } };
}

export type Rgba = { width: number; height: number; data: Uint8ClampedArray };

const rgb565 = (c: number): [number, number, number] => [((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31];

/** Decode the largest image to RGBA. BC1 to BC3 and 32-bit uncompressed are supported; others throw. */
export function decodeDds(bytes: Uint8Array, info: DdsInfo): Rgba {
  const { width, height, format, dataOffset } = info;
  const out = new Uint8ClampedArray(width * height * 4);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (format === "RGBA8" || format === "BGRA8") {
    if (bytes.length < dataOffset + width * height * 4) throw new Error("Truncated DDS data.");
    for (let i = 0; i < width * height; i++) {
      const s = dataOffset + i * 4;
      const [r, b] = format === "RGBA8" ? [bytes[s], bytes[s + 2]] : [bytes[s + 2], bytes[s]];
      out.set([r, bytes[s + 1], b, bytes[s + 3]], i * 4);
    }
    return { width, height, data: out };
  }
  if (format !== "BC1" && format !== "BC2" && format !== "BC3") throw new Error(`${LABEL[format]} cannot be previewed.`);

  const blockBytes = format === "BC1" ? 8 : 16;
  const bw = Math.ceil(width / 4);
  const bh = Math.ceil(height / 4);
  if (bytes.length < dataOffset + bw * bh * blockBytes) throw new Error("Truncated DDS data.");

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const at = dataOffset + (by * bw + bx) * blockBytes;
      const c = at + (format === "BC1" ? 0 : 8);
      const c0 = v.getUint16(c, true);
      const c1 = v.getUint16(c + 2, true);
      const [r0, g0, b0] = rgb565(c0);
      const [r1, g1, b1] = rgb565(c1);
      // BC1 with c0 <= c1 has three colours and a transparent fourth; BC2 and BC3 always use four.
      const four = format !== "BC1" || c0 > c1;
      const pal: number[][] = [
        [r0, g0, b0, 255],
        [r1, g1, b1, 255],
        four ? [(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255] : [(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255],
        four ? [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255] : [0, 0, 0, 0],
      ];
      const idx = v.getUint32(c + 4, true);

      // Alpha: BC2 stores 4 bits per pixel, BC3 two endpoints and 3-bit indices.
      const alpha = new Array<number>(16).fill(255);
      if (format === "BC2") for (let i = 0; i < 16; i++) alpha[i] = ((bytes[at + (i >> 1)] >> ((i & 1) * 4)) & 15) * 17;
      if (format === "BC3") {
        const a0 = bytes[at];
        const a1 = bytes[at + 1];
        const table =
          a0 > a1
            ? [a0, a1, ...[1, 2, 3, 4, 5, 6].map((k) => ((7 - k) * a0 + k * a1) / 7)]
            : [a0, a1, ...[1, 2, 3, 4].map((k) => ((5 - k) * a0 + k * a1) / 5), 0, 255];
        let bits = 0n;
        for (let i = 0; i < 6; i++) bits |= BigInt(bytes[at + 2 + i]) << BigInt(8 * i);
        for (let i = 0; i < 16; i++) alpha[i] = table[Number((bits >> BigInt(3 * i)) & 7n)];
      }

      for (let i = 0; i < 16; i++) {
        const x = bx * 4 + (i & 3);
        const y = by * 4 + (i >> 2);
        if (x >= width || y >= height) continue;
        const p = pal[(idx >> (2 * i)) & 3];
        const o = (y * width + x) * 4;
        out[o] = p[0];
        out[o + 1] = p[1];
        out[o + 2] = p[2];
        out[o + 3] = format === "BC1" ? p[3] : alpha[i];
      }
    }
  }
  return { width, height, data: out };
}

/** Average a decoded image down to `size` x `size` (box filter), for thumbnails. */
export function scaleRgba(img: Rgba, size: number): Rgba {
  if (img.width === size && img.height === size) return img;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor((y * img.height) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / size));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * img.width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / size));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const s = (sy * img.width + sx) * 4;
          // Weight colour by alpha so transparent pixels do not darken the edges.
          const w = img.data[s + 3];
          r += img.data[s] * w;
          g += img.data[s + 1] * w;
          b += img.data[s + 2] * w;
          a += w;
          n++;
        }
      const o = (y * size + x) * 4;
      out[o] = a ? r / a : 0;
      out[o + 1] = a ? g / a : 0;
      out[o + 2] = a ? b / a : 0;
      out[o + 3] = a / n;
    }
  }
  return { width: size, height: size, data: out };
}

/** Encode one 4x4 block (pixels read with clamped coordinates) as BC3: endpoints are the channel min/max, indices the nearest palette entry. */
function encodeBlock(img: Rgba, bx: number, by: number, out: Uint8Array, at: number): void {
  const px: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const x = Math.min(img.width - 1, bx * 4 + (i & 3));
    const y = Math.min(img.height - 1, by * 4 + (i >> 2));
    px.push([...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)]);
  }
  const lo = [255, 255, 255, 255];
  const hi = [0, 0, 0, 0];
  for (const p of px) for (let c = 0; c < 4; c++) (lo[c] = Math.min(lo[c], p[c]), (hi[c] = Math.max(hi[c], p[c])));

  const q = (p: number[]) => ((Math.round(p[0] * 31 / 255) << 11) | (Math.round(p[1] * 63 / 255) << 5) | Math.round(p[2] * 31 / 255));
  let c0 = q(hi);
  let c1 = q(lo);
  if (c0 < c1) [c0, c1] = [c1, c0];
  const [a, b] = [rgb565(c0), rgb565(c1)];
  const pal = [a, b, a.map((v, i) => (2 * v + b[i]) / 3), a.map((v, i) => (v + 2 * b[i]) / 3)];
  let colorBits = 0;
  px.forEach((p, i) => {
    let best = 0, bestD = Infinity;
    pal.forEach((e, k) => {
      const d = (e[0] - p[0]) ** 2 + (e[1] - p[1]) ** 2 + (e[2] - p[2]) ** 2;
      if (d < bestD) (bestD = d, (best = k));
    });
    colorBits |= best << (2 * i);
  });

  const [a0, a1] = [hi[3], lo[3]]; // a0 >= a1: eight-value table
  const table = [a0, a1, ...[1, 2, 3, 4, 5, 6].map((k) => ((7 - k) * a0 + k * a1) / 7)];
  let alphaLo = 0, alphaHi = 0;
  px.forEach((p, i) => {
    let best = 0, bestD = Infinity;
    table.forEach((e, k) => {
      const d = Math.abs(e - p[3]);
      if (d < bestD) (bestD = d, (best = k));
    });
    if (i < 8) alphaLo |= best << (3 * i);
    else alphaHi |= best << (3 * (i - 8));
  });

  const v = new DataView(out.buffer, out.byteOffset + at);
  out[at] = a0;
  out[at + 1] = a1;
  for (let i = 0; i < 3; i++) (out[at + 2 + i] = (alphaLo >> (8 * i)) & 255, (out[at + 5 + i] = (alphaHi >> (8 * i)) & 255));
  v.setUint16(8, c0, true);
  v.setUint16(10, c1, true);
  v.setUint32(12, colorBits >>> 0, true);
}

/** A BC3 (DXT5) DDS of a square RGBA image, with a full mip chain like the shipped icons. */
export function encodeBc3Dds(img: Rgba): Uint8Array {
  const size = img.width;
  const levels: Rgba[] = [img];
  for (let s = size >> 1; s >= 1; s >>= 1) levels.push(scaleRgba(levels[levels.length - 1], s));
  const blocks = (s: number) => Math.ceil(s / 4) ** 2;
  const out = new Uint8Array(128 + levels.reduce((n, l) => n + blocks(l.width) * 16, 0));
  const h = new DataView(out.buffer);
  h.setUint32(0, MAGIC, true);
  h.setUint32(4, 124, true);
  h.setUint32(8, 0xa1007, true); // caps, height, width, pixel format, mip count, linear size
  h.setUint32(12, size, true);
  h.setUint32(16, size, true);
  h.setUint32(20, blocks(size) * 16, true);
  h.setUint32(28, levels.length, true);
  h.setUint32(76, 32, true);
  h.setUint32(80, 4, true);
  out.set([68, 88, 84, 53], 84); // DXT5
  h.setUint32(108, 0x401008, true); // complex, texture, mipmap
  let at = 128;
  for (const l of levels)
    for (let by = 0; by < Math.ceil(l.height / 4); by++)
      for (let bx = 0; bx < Math.ceil(l.width / 4); bx++, at += 16) encodeBlock(l, bx, by, out, at);
  return out;
}
