import cloudinary, {
  generatePublicId,
  IMAGE_TRANSFORMATIONS,
  isCloudinaryConfigured,
} from '../config/cloudinary';
import { BadRequestError, ServiceUnavailableError } from './errors';
import { UploadResult } from './upload';

// ============================================================================
// BUFFER UPLOAD (for Multer in-memory files)
// ============================================================================

export interface BufferUploadOptions {
  folder: string;
  transformation?: keyof typeof IMAGE_TRANSFORMATIONS;
  filename?: string; // Original filename for better public ID
}

/**
 * Upload image from Buffer (Multer in-memory storage)
 * 
 * @param buffer - Image buffer from Multer
 * @param options - Upload configuration
 * @returns Upload result with URLs
 * 
 * @example
 * // In route handler after uploadSingle middleware:
 * const result = await uploadImageFromBuffer(req.file.buffer, {
 *   folder: CLOUDINARY_FOLDERS.PROFILE_IMAGES,
 *   transformation: 'PROFILE_FULL',
 *   filename: req.file.originalname
 * });
 */
export async function uploadImageFromBuffer(
  buffer: Buffer,
  options: BufferUploadOptions
): Promise<UploadResult> {
  // Check Cloudinary configuration
  if (!isCloudinaryConfigured()) {
    throw new ServiceUnavailableError(
      'Image upload service is not configured. Please contact support.'
    );
  }

  // Validate buffer
  if (!buffer || buffer.length === 0) {
    throw new BadRequestError('No image data provided');
  }

  // Convert buffer to base64 data URI
  const base64Data = buffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64Data}`;

  // Generate public ID
  const publicId = generatePublicId(options.folder, options.filename);

  // Prepare upload options
  const uploadOptions: any = {
    public_id: publicId,
    folder: options.folder,
    resource_type: 'image',
    overwrite: false,
    invalidate: true,
  };

  // Add transformation if specified
  if (options.transformation) {
    uploadOptions.transformation = IMAGE_TRANSFORMATIONS[options.transformation];
  }

  try {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, uploadOptions);

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error: any) {
    console.error('Cloudinary buffer upload error:', error);
    throw new ServiceUnavailableError(
      `Image upload failed: ${error.message || 'Unknown error'}`
    );
  }
}

/**
 * Upload multiple images from buffers
 * 
 * @param files - Array of Multer files with buffers
 * @param options - Upload configuration
 * @returns Array of upload results
 */
export async function uploadMultipleImagesFromBuffer(
  files: Express.Multer.File[],
  options: BufferUploadOptions
): Promise<UploadResult[]> {
  if (!files || files.length === 0) {
    throw new BadRequestError('No images provided');
  }

  // Upload all files in parallel
  const uploadPromises = files.map((file) =>
    uploadImageFromBuffer(file.buffer, {
      ...options,
      filename: file.originalname,
    })
  );

  try {
    return await Promise.all(uploadPromises);
  } catch (error) {
    // If any upload fails, we could delete successful ones here
    // For now, just throw the error
    throw error;
  }
}

