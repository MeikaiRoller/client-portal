import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const DEFAULT_SCRYPT_N = 16384;
const DEFAULT_SCRYPT_R = 8;
const DEFAULT_SCRYPT_P = 1;

function parseScryptParams(parts: string[]) {
  const [, nRaw, rRaw, pRaw] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return null;
  }

  return { n, r, p };
}

export function createPasswordHash(plainPassword: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plainPassword, salt, 64, {
    N: DEFAULT_SCRYPT_N,
    r: DEFAULT_SCRYPT_R,
    p: DEFAULT_SCRYPT_P,
  });

  return `scrypt$${DEFAULT_SCRYPT_N}$${DEFAULT_SCRYPT_R}$${DEFAULT_SCRYPT_P}$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const parsed = parseScryptParams(parts);
  if (!parsed) {
    return false;
  }

  const [, , , , salt, expectedHex] = parts;

  const derived = scryptSync(plainPassword, salt, 64, {
    N: parsed.n,
    r: parsed.r,
    p: parsed.p,
  });
  const expected = Buffer.from(expectedHex, "hex");

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}
