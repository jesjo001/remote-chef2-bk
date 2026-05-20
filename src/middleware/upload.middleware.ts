import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, png, webp) and PDFs are allowed'));
  }
};

export const uploadReceipt = multer({
  storage,
  fileFilter,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 }, // 5MB
});
