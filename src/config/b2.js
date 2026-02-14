import crypto from "crypto";
import path from "path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const requiredForUpload = [
  "B2_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_BUCKET_NAME",
  "B2_ENDPOINT"
];

const normalize = (value) => (value ? value.replace(/\/+$/, "") : value);

export const b2Config = {
  keyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
  bucketId: process.env.B2_BUCKET_ID,
  bucketName: process.env.B2_BUCKET_NAME,
  endpoint: normalize(process.env.B2_ENDPOINT),
  downloadUrl: normalize(process.env.B2_DOWNLOAD_URL),
  region: process.env.B2_REGION || "us-east-1"
};

export const getMissingB2UploadVars = () => {
  return requiredForUpload.filter((key) => !process.env[key]);
};

export const isB2UploadConfigured = () => getMissingB2UploadVars().length === 0;

const assertB2Configured = () => {
  const missing = getMissingB2UploadVars();
  if (missing.length) {
    throw new Error(`B2 not configured. Missing: ${missing.join(", ")}`);
  }
};

const b2Client = new S3Client({
  endpoint: b2Config.endpoint,
  region: b2Config.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: b2Config.keyId || "",
    secretAccessKey: b2Config.applicationKey || ""
  }
});

const encodeKeyPath = (objectKey) => objectKey.split("/").map(encodeURIComponent).join("/");

const createObjectKey = ({ userId, originalName }) => {
  const ext = path.extname(originalName || "");
  const safeExt = ext && ext.length <= 10 ? ext.toLowerCase() : "";
  const rand = crypto.randomBytes(16).toString("hex");
  return `portfolio/${userId}/${Date.now()}-${rand}${safeExt}`;
};

export const uploadBufferToB2 = async ({ userId, buffer, mimeType, originalName }) => {
  assertB2Configured();
  const key = createObjectKey({ userId, originalName });
  await b2Client.send(
    new PutObjectCommand({
      Bucket: b2Config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    })
  );

  const url = b2Config.downloadUrl
    ? `${b2Config.downloadUrl}/file/${encodeURIComponent(b2Config.bucketName)}/${encodeKeyPath(key)}`
    : `${b2Config.endpoint}/${encodeURIComponent(b2Config.bucketName)}/${encodeKeyPath(key)}`;

  return { key, url };
};

export const deleteObjectFromB2 = async (key) => {
  if (!key) return;
  assertB2Configured();
  await b2Client.send(
    new DeleteObjectCommand({
      Bucket: b2Config.bucketName,
      Key: key
    })
  );
};
