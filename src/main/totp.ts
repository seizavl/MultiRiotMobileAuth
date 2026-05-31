import crypto from "node:crypto";

export const PERIOD = 30;
const DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/\s+/g, "").replace(/=+$/g, "");
  if (!normalized) {
    throw new Error("シードが空です。");
  }

  let bits = "";
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("シードが不正なBase32です。");
    }
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

export function extractSeed(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      return url.searchParams.get("seed");
    } catch {
      const query = value.split("?", 2)[1];
      if (!query) {
        return null;
      }
      for (const pair of query.split("&")) {
        if (pair.startsWith("seed=")) {
          return pair.slice("seed=".length);
        }
      }
      return null;
    }
  }

  return value;
}

export function getCode(seed: string, now = Date.now()): string {
  const key = decodeBase32(seed);
  const counter = Math.floor(now / 1000 / PERIOD);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));

  const digest = crypto.createHmac("sha256", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const codeInt =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    10 ** DIGITS;

  return codeInt.toString().padStart(DIGITS, "0");
}
