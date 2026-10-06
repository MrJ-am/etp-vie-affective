/** Lecture bornée des dimensions AVANT allocation du décodeur natif. */
export function imageDimensions(bytes: Uint8Array): [number, number] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number, size: number) => String.fromCharCode(...bytes.subarray(at, at + size));
  let dimensions: [number, number] | null = null;
  if (bytes.length >= 24 && bytes[0] === 137 && text(1, 3) === "PNG" && text(12, 4) === "IHDR") {
    dimensions = [v.getUint32(16), v.getUint32(20)];
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at++] !== 255) break;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (at + 2 > bytes.length) break;
      const length = v.getUint16(at);
      if (length < 2 || at + length > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 8) {
        dimensions = [v.getUint16(at + 5), v.getUint16(at + 3)]; break;
      }
      at += length;
    }
  } else if (bytes.length >= 30 && text(0,4) === "RIFF" && text(8,4) === "WEBP") {
    const kind = text(12,4);
    const little24 = (at:number) => bytes[at] | bytes[at+1] << 8 | bytes[at+2] << 16;
    if (kind === "VP8X") dimensions = [1 + little24(24), 1 + little24(27)];
    else if (kind === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42)
      dimensions = [v.getUint16(26,true) & 16383, v.getUint16(28,true) & 16383];
    else if (kind === "VP8L" && bytes[20] === 47) {
      const bits = v.getUint32(21,true);
      dimensions = [1 + (bits & 16383), 1 + ((bits >>> 14) & 16383)];
    }
  }
  if (!dimensions) throw new Error("Choisissez une image JPEG, PNG ou WebP valide.");
  if (dimensions.some(n => n < 1 || n > 20_000) || dimensions[0] * dimensions[1] > 20_000_000)
    throw new Error("Image trop grande : 20 millions de pixels maximum.");
  return dimensions;
}
