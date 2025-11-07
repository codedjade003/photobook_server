// src/config/multer.js
import multer from "multer";
import crypto from "crypto";
import path from "path";

// Memory storage — files stay in RAM temporarily before manual S3 upload
const storage = multer.memoryStorage();

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "video/mp4",
  "video/quicktime",
  "application/octet-stream", // emulator / cached images
];

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type. Only images and videos are allowed."), false);
};

function generateFileName(originalName) {
  const ext = path.extname(originalName);
  const name = crypto.randomBytes(16).toString("hex");
  return `${name}${ext}`;
}

const maxImageSize = parseInt(process.env.MAX_IMAGE_SIZE || "52428800"); // 50MB
const maxVideoSize = parseInt(process.env.MAX_VIDEO_SIZE || "209715200"); // 200MB

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxVideoSize },
});

export { upload, generateFileName, maxImageSize, maxVideoSize };
