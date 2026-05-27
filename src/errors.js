// AccessGrid error hierarchy. All SDK-raised errors descend from
// AccessGridError so customers can `catch (e) { if (e instanceof AccessGridError) }`
// and catch every failure the SDK might throw.

export class AccessGridError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccessGridError";
  }
}

export class AuthenticationError extends AccessGridError {
  constructor(message = "Invalid credentials") {
    super(message);
    this.name = "AuthenticationError";
  }
}

// Thrown when a SmartTap reveal envelope is missing required fields,
// contains non-base64 / non-PEM data, or otherwise can't be parsed.
export class InvalidEnvelopeError extends AccessGridError {
  constructor(message) {
    super(message);
    this.name = "InvalidEnvelopeError";
  }
}

// Thrown when AES-GCM auth-tag verification fails while decrypting a
// SmartTap reveal envelope (wrong key, tampered envelope, or wire-format
// drift between server and SDK).
export class DecryptError extends AccessGridError {
  constructor(message) {
    super(message);
    this.name = "DecryptError";
  }
}
