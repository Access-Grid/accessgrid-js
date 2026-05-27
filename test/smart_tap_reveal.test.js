// Tests for the SmartTap reveal flow.
//
// This file deliberately does NOT override `global.crypto` (unlike
// test/index.test.js which mocks crypto.subtle for HMAC tests). The reveal
// helper uses real Web Crypto API; modern Node (15+) provides it as the
// global `crypto`.

import {
  generateKeypair,
  decryptEnvelope,
} from "../src/smart_tap_reveal_crypto";
import AccessGrid, {
  DecryptError,
  InvalidEnvelopeError,
  RevealTemplatePrivateKey,
  PublishTemplateResponse,
} from "../src/index";

// Captured wire-compat fixture — same caller keypair + envelope used in the
// Elixir / PHP / Java / Ruby specs. caller_private_key is ephemeral and
// single-use by design (server rejects reuse on pubkey fingerprint), so
// committing it carries no credential risk.
const FIXTURE_CALLER_PRIVATE_KEY_PEM = [
  "-----BEGIN EC PRIVATE KEY-----",
  "MHcCAQEEIIou+Kk08kWAjhi0WyIx+L2GrgStGBCPODlwKYKd5BydoAoGCCqGSM49",
  "AwEHoUQDQgAE+gnDxXJt1SBaCK8roKH8QvOa/ItdQUe85JIsUc6RvhD/udLaFtHY",
  "m+MnOmeSdVaKTPWudH0+iGbleB3kS7lYxQ==",
  "-----END EC PRIVATE KEY-----",
].join("\n");

const FIXTURE_ENVELOPE = {
  alg: "ECDH-ES+A256GCM",
  ephemeral_public_key: [
    "-----BEGIN PUBLIC KEY-----",
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7mg6i99GcIVutMPr/PXSBSQVlbLM",
    "tnJO10ZBjk9ZTfw6wwAVNBnDBiqY7VrdOG1JdFOYoac+NkAlyMRGYk2tVQ==",
    "-----END PUBLIC KEY-----",
    "",
  ].join("\n"),
  iv: "5X2OCht+kLB/xQmX",
  ciphertext: "ckYyA3FdRYjOFI/FKz/QeR5Yf9nZZFzo73kDXKZSB/EgbQ==",
  tag: "0vwkjVaCwi5zl37xvJPxeg==",
};

const FIXTURE_EXPECTED_PLAINTEXT = "FIXTURE-PLAINTEXT-NOT-A-CREDENTIAL";

// Load the captured EC private key as a Web Crypto CryptoKey. The EC1
// PEM (with `BEGIN EC PRIVATE KEY`) needs to be converted to PKCS#8 first,
// or we can use Node's `createPrivateKey` + jwk export to reach Web Crypto.
async function loadFixturePrivateKey() {
  const { createPrivateKey } = await import("node:crypto");
  const nodeKey = createPrivateKey(FIXTURE_CALLER_PRIVATE_KEY_PEM);
  const jwk = nodeKey.export({ format: "jwk" });
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
}

describe("SmartTapRevealCrypto.decryptEnvelope", () => {
  test("decrypts the captured server-produced envelope", async () => {
    const priv = await loadFixturePrivateKey();
    const plaintext = await decryptEnvelope(FIXTURE_ENVELOPE, priv);
    expect(plaintext).toBe(FIXTURE_EXPECTED_PLAINTEXT);
  });

  test("throws DecryptError when the auth tag is tampered", async () => {
    const priv = await loadFixturePrivateKey();
    const rawTag = Uint8Array.from(atob(FIXTURE_ENVELOPE.tag), (c) => c.charCodeAt(0));
    rawTag[0] ^= 0x01;
    let binary = "";
    for (let i = 0; i < rawTag.length; i++) binary += String.fromCharCode(rawTag[i]);
    const tampered = { ...FIXTURE_ENVELOPE, tag: btoa(binary) };

    await expect(decryptEnvelope(tampered, priv)).rejects.toBeInstanceOf(
      DecryptError,
    );
  });

  test("throws DecryptError when a different private key is used", async () => {
    const { privateKey: wrong } = await generateKeypair();
    // generateKeypair returns a CryptoKey with the WRONG keypair material.
    // Pass the private key from a fresh pair against the fixture envelope.
    const wrongPriv = wrong;
    await expect(
      decryptEnvelope(FIXTURE_ENVELOPE, wrongPriv),
    ).rejects.toBeInstanceOf(DecryptError);
  });

  test("throws InvalidEnvelopeError when ephemeral_public_key is missing", async () => {
    const priv = await loadFixturePrivateKey();
    const { ephemeral_public_key, ...rest } = FIXTURE_ENVELOPE;
    void ephemeral_public_key;
    await expect(decryptEnvelope(rest, priv)).rejects.toBeInstanceOf(
      InvalidEnvelopeError,
    );
  });

  test("throws InvalidEnvelopeError when iv is not base64", async () => {
    const priv = await loadFixturePrivateKey();
    const bad = { ...FIXTURE_ENVELOPE, iv: "not!base64!" };
    await expect(decryptEnvelope(bad, priv)).rejects.toBeInstanceOf(
      InvalidEnvelopeError,
    );
  });
});

describe("SmartTapRevealCrypto.generateKeypair", () => {
  test("returns a privateKey CryptoKey and a public PEM", async () => {
    const { publicKeyPem, privateKey } = await generateKeypair();
    expect(publicKeyPem).toContain("-----BEGIN PUBLIC KEY-----");
    expect(publicKeyPem).toContain("-----END PUBLIC KEY-----");
    expect(privateKey).toBeDefined();
    expect(privateKey.algorithm.name).toBe("ECDH");
    expect(privateKey.algorithm.namedCurve).toBe("P-256");
  });

  test("each call returns a distinct public PEM", async () => {
    const a = await generateKeypair();
    const b = await generateKeypair();
    expect(a.publicKeyPem).not.toBe(b.publicKeyPem);
  });
});

describe("RevealTemplatePrivateKey model", () => {
  test("maps snake_case wire fields to camelCase properties", () => {
    const result = new RevealTemplatePrivateKey({
      key_version: "tmpl-42",
      collector_id: "12345678",
      fingerprint: "sha256:deadbeef",
      private_key: FIXTURE_EXPECTED_PLAINTEXT,
    });
    expect(result.keyVersion).toBe("tmpl-42");
    expect(result.collectorId).toBe("12345678");
    expect(result.fingerprint).toBe("sha256:deadbeef");
    expect(result.privateKey).toBe(FIXTURE_EXPECTED_PLAINTEXT);
  });
});

describe("PublishTemplateResponse model", () => {
  test("captures id and status from the wire shape", () => {
    const result = new PublishTemplateResponse({
      id: "tmpl-42",
      status: "in-review",
    });
    expect(result.id).toBe("tmpl-42");
    expect(result.status).toBe("in-review");
  });
});
