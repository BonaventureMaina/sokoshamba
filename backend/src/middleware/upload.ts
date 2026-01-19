import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { BadRequestError } from '../utils/errors';

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

/**
 * Storage configuration - use memory storage
 * Files are kept in memory as Buffer objects, then uploaded to Cloudinary
 * This avoids writing temporary files to disk
 */
const storage = multer.memoryStorage();

/**
 * File filter - validate file types before accepting upload
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allowed image MIME types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(
      new BadRequestError(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
      )
    );
  }
};

// ============================================================================
// MULTER INSTANCES
// ============================================================================

/**
 * Single image upload (e.g., profile picture)
 * Field name: 'image'
 * Max size: 5MB
 */
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single('image');

/**
 * Multiple images upload (e.g., product images)
 * Field name: 'images'
 * Max count: 5 images
 * Max size per file: 8MB
 */
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB per file
    files: 5, // Max 5 files
  },
}).array('images', 5);

/**
 * Profile image upload (optimized for avatars)
 * Field name: 'profileImage'
 * Max size: 3MB
 */
export const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
  },
}).single('profileImage');

/**
 * Product images upload (multiple)
 * Field name: 'productImages'
 * Max count: 5 images
 * Max size: 8MB each
 */
export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB
    files: 5,
  },
}).array('productImages', 5);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Multer error handler
 * Converts Multer errors to user-friendly messages
 * 
 * Usage: Place after upload middleware
 * Example: router.post('/upload', uploadSingle, handleUploadError, controller)
 */
export function handleUploadError(
  error: any,
  req: Request,
  res: any,
  next: any
) {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(
        new BadRequestError(
          `File too large. Maximum size is ${Math.round(
            (error as any).limit / 1024 / 1024
          )}MB`
        )
      );
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return next(
        new BadRequestError(
          `Too many files. Maximum is ${(error as any).limit} files`
        )
      );
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(
        new BadRequestError(
          `Unexpected field name. Expected '${(error as any).field}'`
        )
      );
    }

    // Generic Multer error
    return next(new BadRequestError(`Upload error: ${error.message}`));
  }

  // Pass through other errors
  next(error);
}
