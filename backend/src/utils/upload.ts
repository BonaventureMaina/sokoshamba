import cloudinary, {
  generatePublicId,
  extractPublicId,
  CLOUDINARY_FOLDERS,
  IMAGE_TRANSFORMATIONS,
  isCloudinaryConfigured,
} from '../config/cloudinary';
import { BadRequestError, ServiceUnavailableError } from './errors';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// UPLOAD OPTIONS
// ============================================================================

export interface UploadOptions {
  folder: string; // Cloudinary folder path
  transformation?: keyof typeof IMAGE_TRANSFORMATIONS;
  maxSizeBytes?: number; // Max file size in bytes
  allowedFormats?: string[]; // Allowed file extensions
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload image to Cloudinary from local file path
 * 
 * @param filePath - Local file path
 * @param options - Upload configuration
 * @returns Upload result with URLs
 * @throws ServiceUnavailableError if Cloudinary not configured
 * @throws BadRequestError if file validation fails
 */
export async function uploadImage(
  filePath: string,
  options: UploadOptions
): Promise<UploadResult> {
  // Check Cloudinary configuration
  if (!isCloudinaryConfigured()) {
    throw new ServiceUnavailableError(
      'Image upload service is not configured. Please contact support.'
    );
  }

  // Validate file exists
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new BadRequestError('File not found');
  }

  // Validate file size
  if (options.maxSizeBytes) {
    const stats = await fs.stat(filePath);
    if (stats.size > options.maxSizeBytes) {
      throw new BadRequestError(
        `File size exceeds maximum of ${Math.round(options.maxSizeBytes / 1024 / 1024)}MB`
      );
    }
  }

  // Validate file format
  const fileExt = path.extname(filePath).toLowerCase().substring(1);
  if (options.allowedFormats && !options.allowedFormats.includes(fileExt)) {
    throw new BadRequestError(
      `File format .${fileExt} not allowed. Allowed formats: ${options.allowedFormats.join(', ')}`
    );
  }

  // Generate public ID
  const filename = path.basename(filePath, path.extname(filePath));
  const publicId = generatePublicId(options.folder, filename);

  // Prepare upload options
  const uploadOptions: any = {
    public_id: publicId,
    folder: options.folder,
    resource_type: 'image',
    overwrite: false, // Don't overwrite existing images
    invalidate: true, // Clear CDN cache
  };

  // Add transformation if specified
  if (options.transformation) {
    uploadOptions.transformation = IMAGE_TRANSFORMATIONS[options.transformation];
  }

  try {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    // Return standardized result
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
    console.error('Cloudinary upload error:', error);
    throw new ServiceUnavailableError(
      `Image upload failed: ${error.message || 'Unknown error'}`
    );
  }
}

/**
 * Upload image from base64 string
 * Useful for uploads from frontend without file system
 * 
 * @param base64Data - Base64 encoded image data (with or without data URI prefix)
 * @param options - Upload configuration
 * @returns Upload result
 */
export async function uploadBase64Image(
  base64Data: string,
  options: UploadOptions
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new ServiceUnavailableError('Image upload service is not configured');
  }

  // Ensure data URI prefix
  let dataUri = base64Data;
  if (!base64Data.startsWith('data:')) {
    // Assume JPEG if no prefix
    dataUri = `data:image/jpeg;base64,${base64Data}`;
  }

  // Validate base64 format
  const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
  if (!base64Regex.test(dataUri)) {
    throw new BadRequestError('Invalid base64 image format');
  }

  // Validate size (rough estimate: base64 is ~1.33x larger than binary)
  if (options.maxSizeBytes) {
    const estimatedBytes = (dataUri.length * 0.75); // Approximate binary size
    if (estimatedBytes > options.maxSizeBytes) {
      throw new BadRequestError(
        `Image size exceeds maximum of ${Math.round(options.maxSizeBytes / 1024 / 1024)}MB`
      );
    }
  }

  // Generate public ID
  const publicId = generatePublicId(options.folder);

  const uploadOptions: any = {
    public_id: publicId,
    folder: options.folder,
    resource_type: 'image',
    overwrite: false,
    invalidate: true,
  };

  if (options.transformation) {
    uploadOptions.transformation = IMAGE_TRANSFORMATIONS[options.transformation];
  }

  try {
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
    console.error('Cloudinary base64 upload error:', error);
    throw new ServiceUnavailableError(`Image upload failed: ${error.message}`);
  }
}

/**
 * Delete image from Cloudinary
 * 
 * @param publicId - Cloudinary public ID
 * @returns true if deleted successfully
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    console.warn('Cloudinary not configured, skipping image deletion');
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error: any) {
    console.error('Cloudinary delete error:', error);
    return false; // Don't throw, just log failure
  }
}

/**
 * Delete image from Cloudinary by URL
 * Extracts public ID from URL and deletes
 * 
 * @param url - Cloudinary image URL
 * @returns true if deleted successfully
 */
export async function deleteImageByUrl(url: string): Promise<boolean> {
  const publicId = extractPublicId(url);
  if (!publicId) {
    console.warn('Could not extract public ID from URL:', url);
    return false;
  }
  return deleteImage(publicId);
}

/**
 * Replace existing image (delete old, upload new)
 * Atomic operation that ensures old image is only deleted if new upload succeeds
 * 
 * @param oldImageUrl - URL of image to replace (can be null)
 * @param newFilePath - Path to new image file
 * @param options - Upload configuration
 * @returns Upload result for new image
 */
export async function replaceImage(
  oldImageUrl: string | null,
  newFilePath: string,
  options: UploadOptions
): Promise<UploadResult> {
  // Upload new image first
  const uploadResult = await uploadImage(newFilePath, options);

  // Only delete old image after new upload succeeds
  if (oldImageUrl) {
    await deleteImageByUrl(oldImageUrl);
  }

  return uploadResult;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate image file extension
 * 
 * @param filename - File name with extension
 * @param allowedFormats - Allowed extensions (default: jpg, jpeg, png, webp)
 * @returns true if valid, false otherwise
 */
export function isValidImageFormat(
  filename: string,
  allowedFormats: string[] = ['jpg', 'jpeg', 'png', 'webp', 'gif']
): boolean {
  const ext = path.extname(filename).toLowerCase().substring(1);
  return allowedFormats.includes(ext);
}

/**
 * Validate image file size
 * 
 * @param sizeBytes - File size in bytes
 * @param maxSizeMB - Maximum size in megabytes (default: 5MB)
 * @returns true if valid, false otherwise
 */
export function isValidImageSize(
  sizeBytes: number,
  maxSizeMB: number = 5
): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return sizeBytes <= maxBytes;
}

// ============================================================================
// PRESET UPLOAD CONFIGURATIONS
// ============================================================================

/**
 * Upload profile image with standard settings
 */
export async function uploadProfileImage(filePath: string): Promise<UploadResult> {
  return uploadImage(filePath, {
    folder: CLOUDINARY_FOLDERS.PROFILE_IMAGES,
    transformation: 'PROFILE_FULL',
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  });
}

/**
 * Upload product image with standard settings
 */
export async function uploadProductImage(filePath: string): Promise<UploadResult> {
  return uploadImage(filePath, {
    folder: CLOUDINARY_FOLDERS.PRODUCT_IMAGES,
    transformation: 'PRODUCT_FULL',
    maxSizeBytes: 8 * 1024 * 1024, // 8MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  });
}
