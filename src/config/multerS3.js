// src/config/multerS3.js
import multer from "multer";
import multerS3 from "multer-s3";
import s3 from "../utils/s3.js";
import path from "path";
import crypto from "crypto";

const bucket = process.env.S3_BUCKET_NAME;
const maxImageSize = parseInt(process.env.MAX_IMAGE_SIZE || "52428800"); // default 50MB
const maxVideoSize = parseInt(process.env.MAX_VIDEO_SIZE || "209715200"); // default 200MB

function generateKey(filename) {
  const ext = path.extname(filename);
  const name = crypto.randomBytes(16).toString("hex");
  return `${name}${ext}`;
}

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg", "video/mp4", "video/quicktime", "video/quicktime"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type. Only images and videos are allowed."), false);
};

const upload = multer({
  fileFilter,
  storage: multerS3({
    s3,
    bucket,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const key = generateKey(file.originalname);
      cb(null, key);
    },
  }),
  limits: {
    fileSize: maxVideoSize, // overall limit. We'll check per-file type in route
  },
});

export { upload, maxImageSize, maxVideoSize };
