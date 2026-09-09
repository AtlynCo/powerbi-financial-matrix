import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// Original 20px statement/grid glyph; no fonts, downloaded artwork or external assets.
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, crc]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(20, 0);
header.writeUInt32BE(20, 4);
header[8] = 8;
header[9] = 6;
const pixels = Buffer.alloc(20 * 81);
for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
  const ink = x >= 2 && x <= 17 && y >= 2 && y <= 17
    && (y <= 5 || y === 9 || y === 13 || y === 17 || x === 2 || x === 10 || x === 17);
  const offset = y * 81 + 1 + x * 4;
  pixels.set(ink ? [26, 64, 92, 255] : [255, 255, 255, 255], offset);
}
mkdirSync("assets", { recursive: true });
writeFileSync("assets/icon.png", Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))
]));
