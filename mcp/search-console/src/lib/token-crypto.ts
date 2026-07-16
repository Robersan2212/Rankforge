import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";

const NONCE_BYTES = 12;
const KEY_BYTES = 32;

function encryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }

  const attempts = [
    () => Buffer.from(raw, "base64url"),
    () => Buffer.from(raw + "==", "base64"),
    () => Buffer.from(raw, "hex"),
    () => Buffer.from(raw, "utf8"),
  ];

  for (const attempt of attempts) {
    try {
      const key = attempt();
      if (key.length === KEY_BYTES) return key;
    } catch {
      // try next
    }
  }

  throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes");
}

export function decryptToken(encrypted: string): string {
  const key = encryptionKey();
  const buf = Buffer.from(encrypted, "base64url");
  const nonce = buf.subarray(0, NONCE_BYTES);
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(NONCE_BYTES, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptToken(plaintext: string): string {
  const key = encryptionKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, enc, tag]).toString("base64url");
}
