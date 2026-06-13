import crypto from "crypto";
import { env } from "../env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_BYTE_LENGTH = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  
  const keyHex = env.WIX_TOKENS_MASTER_KEY;
  const keyBuffer = Buffer.from(keyHex, "hex");
  
  if (keyBuffer.length !== KEY_BYTE_LENGTH) {
    throw new Error(`WIX_TOKENS_MASTER_KEY must represent exactly ${KEY_BYTE_LENGTH} bytes (64 hex characters)`);
  }
  
  cachedKey = keyBuffer;
  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted token string (format: iv_hex:auth_tag_hex:ciphertext_hex) using AES-256-GCM.
 */
export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const key = getKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
