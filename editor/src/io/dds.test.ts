import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeDds, encodeBc3Dds, parseDds, scaleRgba, type DdsInfo } from "./dds";

/** A DDS file with the given header fields and raw data. */
function dds(opts: { w: number; h: number; fourcc?: string; dxgi?: number; data: number[]; bits?: number; rMask?: number }): Uint8Array {
  const head = new Uint8Array(128 + (opts.dxgi ? 20 : 0));
  const v = new DataView(head.buffer);
  v.setUint32(0, 0x20534444, true);
  v.setUint32(4, 124, true);
  v.setUint32(12, opts.h, true);
  v.setUint32(16, opts.w, true);
  v.setUint32(76, 32, true);
  if (opts.fourcc || opts.dxgi) {
    v.setUint32(80, 4, true);
    for (const [i, ch] of [...(opts.dxgi ? "DX10" : opts.fourcc!)].entries()) head[84 + i] = ch.charCodeAt(0);
    if (opts.dxgi) v.setUint32(128, opts.dxgi, true);
  } else {
    v.setUint32(80, 0x41, true);
    v.setUint32(88, opts.bits ?? 32, true);
    v.setUint32(92, opts.rMask ?? 0xff, true);
  }
  return new Uint8Array([...head, ...opts.data]);
}
const info = (bytes: Uint8Array): DdsInfo => {
  const r = parseDds(bytes);
  if (!r.ok) throw new Error(r.error);
  return r.info;
};

// One 4x4 block of every colour index 0, endpoints c0 = pure red (565), c1 = black.
const BC1_RED = [0x00, 0xf8, 0x00, 0x00, 0, 0, 0, 0];

describe("parseDds", () => {
  it("names the format and checks size and support", () => {
    const bc3 = info(dds({ w: 512, h: 512, fourcc: "DXT5", data: [] }));
    expect(bc3).toMatchObject({ format: "BC3", supported: true, problems: [] });
    expect(info(dds({ w: 512, h: 512, fourcc: "DXT1", data: [] })).format).toBe("BC1");
    expect(info(dds({ w: 512, h: 512, fourcc: "DXT3", data: [] })).format).toBe("BC2");
  });
  it("rejects BC4, BC5 and BC7 (the game supports BC3 at most), including DX10-headered files", () => {
    for (const [name, bytes] of [
      ["BC5", dds({ w: 512, h: 512, fourcc: "ATI2", data: [] })],
      ["BC4", dds({ w: 512, h: 512, fourcc: "ATI1", data: [] })],
      ["BC7", dds({ w: 512, h: 512, dxgi: 98, data: [] })],
    ] as const) {
      const i = info(bytes);
      expect(i.format).toBe(name);
      expect(i.supported).toBe(false);
      expect(i.problems[0]).toMatch(/not supported.*BC3/);
    }
    expect(info(dds({ w: 512, h: 512, dxgi: 77, data: [] }))).toMatchObject({ format: "BC3", supported: true });
  });
  it("flags a size other than 512x512", () => {
    expect(info(dds({ w: 256, h: 128, fourcc: "DXT5", data: [] })).problems).toEqual(["Icons should be 512×512, this one is 256×128."]);
  });
  it("refuses things that are not DDS", () => {
    expect(parseDds(new Uint8Array(200))).toEqual({ ok: false, error: "Not a DDS file." });
    expect(parseDds(new Uint8Array(10))).toMatchObject({ ok: false });
  });
});

describe("decodeDds", () => {
  it("decodes a BC1 block", () => {
    const b = dds({ w: 4, h: 4, fourcc: "DXT1", data: BC1_RED });
    const img = decodeDds(b, info(b));
    expect([...img.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect(img.data).toHaveLength(4 * 4 * 4);
  });
  it("BC1 with c0 <= c1 has a transparent fourth colour", () => {
    // c0 = black, c1 = red, every index 3.
    const b = dds({ w: 4, h: 4, fourcc: "DXT1", data: [0, 0, 0x00, 0xf8, 0xff, 0xff, 0xff, 0xff] });
    expect(decodeDds(b, info(b)).data[3]).toBe(0);
  });
  it("decodes BC3 colour and interpolated alpha", () => {
    // alpha endpoints 0 and 255 (a0 <= a1: 4 steps plus 0 and 255); pixel 0 has index 0 (= a0 = 0), pixel 1 index 1 (= a1 = 255).
    const alphaBits = [0b00001000, 0, 0, 0, 0, 0];
    const b = dds({ w: 4, h: 4, fourcc: "DXT5", data: [0, 255, ...alphaBits, ...BC1_RED] });
    const px = decodeDds(b, info(b)).data;
    expect([...px.slice(0, 4)]).toEqual([255, 0, 0, 0]);
    expect(px[7]).toBe(255);
    // Index 7 means opaque in the table used when a0 <= a1.
    const all7 = [0, 255, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
    const c = dds({ w: 4, h: 4, fourcc: "DXT5", data: [...all7, ...BC1_RED] });
    expect(decodeDds(c, info(c)).data[3]).toBe(255);
  });
  it("decodes BC2 explicit alpha", () => {
    const b = dds({ w: 4, h: 4, fourcc: "DXT3", data: [0xf0, 0xff, 0, 0, 0, 0, 0, 0, ...BC1_RED] });
    const px = decodeDds(b, info(b)).data;
    expect(px[3]).toBe(0); // pixel 0: nibble 0
    expect(px[7]).toBe(255); // pixel 1: nibble 15
  });
  it("decodes uncompressed BGRA and RGBA", () => {
    const bgra = dds({ w: 1, h: 1, data: [10, 20, 30, 40], rMask: 0xff0000 });
    expect([...decodeDds(bgra, info(bgra)).data]).toEqual([30, 20, 10, 40]);
    const rgba = dds({ w: 1, h: 1, data: [10, 20, 30, 40], rMask: 0xff });
    expect([...decodeDds(rgba, info(rgba)).data]).toEqual([10, 20, 30, 40]);
  });
  it("refuses formats it cannot decode, and truncated data", () => {
    const bc7 = dds({ w: 4, h: 4, dxgi: 98, data: new Array(16).fill(0) });
    expect(() => decodeDds(bc7, info(bc7))).toThrow(/cannot be previewed/);
    const short = dds({ w: 8, h: 8, fourcc: "DXT1", data: BC1_RED });
    expect(() => decodeDds(short, info(short))).toThrow(/Truncated/);
  });
});

describe("scaleRgba", () => {
  it("averages blocks and weights colour by alpha", () => {
    const img = { width: 2, height: 2, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0]) };
    const s = scaleRgba(img, 1);
    expect([...s.data]).toEqual([128, 0, 128, 128]); // (red + blue) / 2, two of four pixels opaque
  });
});

describe("shipped icons", () => {
  const dir = join(__dirname, "../../../Skyrim/Data/SKSE/Plugins/AchievementsData/Icons");
  const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : f.endsWith(".dds") ? [join(d, f)] : []));
  const all = files(dir);

  it("are all BC3 at 512x512, the documented limit", () => {
    expect(all.length).toBeGreaterThan(50);
    for (const f of all) {
      const r = parseDds(new Uint8Array(readFileSync(f)));
      expect(r.ok && r.info).toMatchObject({ format: "BC3", width: 512, height: 512, supported: true, problems: [] });
    }
  });
  it("decode to a real picture", () => {
    const bytes = new Uint8Array(readFileSync(join(dir, "Default.dds")));
    const r = parseDds(bytes);
    if (!r.ok) throw new Error(r.error);
    const img = scaleRgba(decodeDds(bytes, r.info), 64);
    let opaque = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 200) opaque++;
    expect(opaque).toBeGreaterThan(64 * 64 * 0.1);
  });
});

describe("encodeBc3Dds", () => {
  it("writes a 512x512 BC3 file with a full mip chain that decodes back to the picture", () => {
    const data = new Uint8ClampedArray(512 * 512 * 4);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) data.set(x < 256 ? [255, 0, 0, 255] : [0, 0, 255, y < 256 ? 255 : 0], (y * 512 + x) * 4);
    const bytes = encodeBc3Dds({ width: 512, height: 512, data });
    const i = info(bytes);
    expect(i).toMatchObject({ format: "BC3", width: 512, height: 512, supported: true, problems: [] });
    expect(bytes.length).toBe(128 + 349552);
    const back = decodeDds(bytes, i).data;
    const at = (x: number, y: number) => [...back.slice((y * 512 + x) * 4, (y * 512 + x) * 4 + 4)];
    expect(at(100, 100)).toEqual([255, 0, 0, 255]);
    expect(at(400, 100)).toEqual([0, 0, 255, 255]);
    expect(at(400, 400)[3]).toBe(0);
  });
});
