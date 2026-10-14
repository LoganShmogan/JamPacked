// PBKDF2-SHA256 password hashing via Web Crypto (available in the Convex runtime).
// Development-only local accounts; production auth moves to Clerk.
const ITERATIONS = 100_000;

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

export function randomHex(bytes: number) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hashPassword(password: string, saltHex = randomHex(16)) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: ITERATIONS },
    key,
    256,
  );
  return { hash: toHex(bits), salt: saltHex };
}

export async function verifyPassword(password: string, saltHex: string, expectedHex: string) {
  const { hash } = await hashPassword(password, saltHex);
  // constant-time compare
  let diff = hash.length ^ expectedHex.length;
  for (let i = 0; i < Math.min(hash.length, expectedHex.length); i++) {
    diff |= hash.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}
