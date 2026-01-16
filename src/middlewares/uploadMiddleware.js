const multer = require("multer");
const path = require("path");

/**
 * Configure storage for Multer
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Files will be stored in backend/uploads
  },
  filename: (req, file, cb) => {
    // Generate unique filename: TIMESTAMP-ORIGINALNAME
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

/**
 * File filter to restrict types (Optional but recommended)
 */
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only JPG, PNG, GIF, and PDF are allowed."),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = upload;
