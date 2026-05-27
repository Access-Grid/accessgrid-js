/**
 * Internal crypto helpers for the SmartTap reveal flow.
 *
 * Driven by ConsoleApi.revealSmartTap; not part of the public SDK surface.
 * Uses Web Crypto API exclusively so the SDK stays isomorphic (Node 15+ and
 * browsers). No new runtime dependencies.
 *
 * Custom errors live in index.js (DecryptError, InvalidEnvelopeError); this
 * module imports them via lazy require to avoid a circular import at load time.
 */

import { DecryptError, InvalidEnvelopeError } from "./errors.js";

const CURVE = "P-256";
const HKDF_INFO = "accessgrid-smart-tap-reveal-v1";
const SHARED_SECRET_BITS = 256;
const AES_KEY_BITS = 256;
const GCM_TAG_BITS = 128;

// Generate a fresh ephemeral P-256 keypair for a reveal call.
// Returns `{ publicKeyPem, privateKey }`:
//   - publicKeyPem: SubjectPublicKeyInfo PEM string, ready to submit
//   - privateKey:   Web Crypto CryptoKey, kept for decryptEnvelope
export async function generateKeypair() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: CURVE },
    true,
    ["deriveBits"],
  );
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return { publicKeyPem: spkiBufferToPem(spki), privateKey };
}

// Decrypt the encrypted_private_key envelope returned by the reveal endpoint.
// Returns the plaintext SmartTap PEM as a string.
// Throws InvalidEnvelopeError on missing/bad envelope; DecryptError on
// auth-tag verification failure.
export async function decryptEnvelope(envelope, privateKey) {
  const serverPub = await importServerPub(envelope);
  const iv = decodeBase64(envelope.iv, "iv");
  const ciphertext = decodeBase64(envelope.ciphertext, "ciphertext");
  const tag = decodeBase64(envelope.tag, "tag");

  const aesKey = await deriveAesKey(privateKey, serverPub);

  // Web Crypto's AES-GCM decrypt wants ciphertext||tag concatenated.
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  let plaintextBuf;
  try {
    plaintextBuf = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: GCM_TAG_BITS,
        additionalData: new Uint8Array(0),
      },
      aesKey,
      combined,
    );
  } catch {
    throw new DecryptError("AES-GCM decryption failed (auth tag verification)");
  }
  return new TextDecoder().decode(plaintextBuf);
}

async function importServerPub(envelope) {
  const pem = envelope && envelope.ephemeral_public_key;
  if (typeof pem !== "string" || pem.length === 0) {
    throw new InvalidEnvelopeError("Invalid ephemeral_public_key in envelope");
  }
  try {
    const spki = pemToSpkiBytes(pem);
    return await crypto.subtle.importKey(
      "spki",
      spki,
      { name: "ECDH", namedCurve: CURVE },
      false,
      [],
    );
  } catch (e) {
    if (e instanceof InvalidEnvelopeError) throw e;
    throw new InvalidEnvelopeError("Invalid ephemeral_public_key in envelope");
  }
}

async function deriveAesKey(privateKey, serverPub) {
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPub },
    privateKey,
    SHARED_SECRET_BITS,
  );
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedSecretBits,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const aesKeyBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(HKDF_INFO),
    },
    hkdfKey,
    AES_KEY_BITS,
  );
  return crypto.subtle.importKey(
    "raw",
    aesKeyBits,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}

function decodeBase64(value, fieldName) {
  if (typeof value !== "string") {
    throw new InvalidEnvelopeError(
      `Envelope ${fieldName} must be base64-encoded`,
    );
  }
  try {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    throw new InvalidEnvelopeError(
      `Envelope ${fieldName} must be base64-encoded`,
    );
  }
}

function pemToSpkiBytes(pem) {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  if (body.length === 0) {
    throw new InvalidEnvelopeError("Invalid ephemeral_public_key in envelope");
  }
  return decodeBase64(body, "ephemeral_public_key");
}

function spkiBufferToPem(spkiBuf) {
  const bytes = new Uint8Array(spkiBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const lines = b64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}
