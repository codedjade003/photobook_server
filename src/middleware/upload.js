import multer from "multer";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "video/mp4",
  "video/quicktime"
]);

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 20);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadMb * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      const err = new Error("Invalid file type. Allowed: jpeg, jpg, png, webp, mp4, mov");
      err.code = "INVALID_FILE_TYPE";
      err.statusCode = 400;
      cb(err);
      return;
    }
    cb(null, true);
  }
});

export default upload;
