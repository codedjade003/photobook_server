import crypto from "crypto";

const KEY_BYTES = 32;
const VERSION_PREFIX = "v1:";

let cachedKey = null;

const resolveKey = () => {
  if (cachedKey) return cachedKey;

  const raw = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MESSAGE_ENCRYPTION_KEY is required in production");
    }
    console.warn("Warning: MESSAGE_ENCRYPTION_KEY not set; using ephemeral key.");
    cachedKey = crypto.randomBytes(KEY_BYTES);
    return cachedKey;
  }

  let keyBuffer = null;

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    keyBuffer = Buffer.from(raw, "hex");
  } else {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_BYTES) {
      keyBuffer = decoded;
    }
  }

  if (!keyBuffer) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MESSAGE_ENCRYPTION_KEY must be 32-byte base64 or hex");
    }
    console.warn("Warning: MESSAGE_ENCRYPTION_KEY is not 32-byte base64/hex; deriving key for dev.");
    keyBuffer = crypto.createHash("sha256").update(raw).digest();
  }

  cachedKey = keyBuffer;
  return cachedKey;
};

export const encryptMessage = (plaintext) => {
  if (plaintext === null || plaintext === undefined) return null;

  const key = resolveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

export const decryptMessage = (payload) => {
  if (!payload) return null;

  const key = resolveKey();
  const encoded = payload.startsWith(VERSION_PREFIX)
    ? payload.slice(VERSION_PREFIX.length)
    : payload;

  const parts = encoded.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload");
  }

  const [ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const encrypted = Buffer.from(dataPart, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
};
