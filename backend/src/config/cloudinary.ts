import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// CLOUDINARY CONFIGURATION
// ============================================================================

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Validate credentials on module load (fail fast)
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn(
    '⚠️  WARNING: Cloudinary credentials not found in environment variables.\n' +
    '   Image upload features will not work.\n' +
    '   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env'
  );
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS
});

// ============================================================================
// CLOUDINARY FOLDERS (organize uploads by type)
// ============================================================================

export const CLOUDINARY_FOLDERS = {
  PROFILE_IMAGES: 'sokoshamba/users/profiles',
  PRODUCT_IMAGES: 'sokoshamba/products',
  FARMER_IMAGES: 'sokoshamba/farmers',
  TEMP: 'sokoshamba/temp', // For temporary uploads
} as const;

// ============================================================================
// IMAGE TRANSFORMATION PRESETS
// ============================================================================

/**
 * Cloudinary transformation configurations
 * These define how images are processed on upload
 */
export const IMAGE_TRANSFORMATIONS = {
  // Profile pictures (avatars)
  PROFILE_AVATAR: {
    width: 200,
    height: 200,
    crop: 'fill', // Crop to fill dimensions
    gravity: 'face', // Focus on face if detected
    quality: 'auto:good',
    format: 'auto', // Auto-select WebP or fallback
  },

  // Profile picture (full size)
  PROFILE_FULL: {
    width: 800,
    height: 800,
    crop: 'limit', // Resize but don't exceed dimensions
    quality: 'auto:best',
    format: 'auto',
  },

  // Product images (thumbnail)
  PRODUCT_THUMB: {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto',
  },

  // Product images (full size)
  PRODUCT_FULL: {
    width: 1200,
    height: 1200,
    crop: 'limit',
    quality: 'auto:best',
    format: 'auto',
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate public ID for uploaded image
 * Format: folder/timestamp_randomId
 * 
 * @param folder - Cloudinary folder path
 * @param filename - Original filename (optional)
 * @returns Public ID string
 */
export function generatePublicId(folder: string, filename?: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const sanitizedFilename = filename
    ? filename.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
    : 'image';
  
  return `${folder}/${timestamp}_${randomId}_${sanitizedFilename}`;
}

/**
 * Extract public ID from Cloudinary URL
 * 
 * @param url - Cloudinary image URL
 * @returns Public ID or null
 * 
 * @example
 * extractPublicId('https://res.cloudinary.com/demo/image/upload/v1/sokoshamba/users/profiles/123.jpg')
 * // Returns: 'sokoshamba/users/profiles/123'
 */
export function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Build Cloudinary URL with transformations
 * 
 * @param publicId - Cloudinary public ID
 * @param transformation - Transformation preset name
 * @returns Transformed image URL
 */
export function buildImageUrl(
  publicId: string,
  transformation?: keyof typeof IMAGE_TRANSFORMATIONS
): string {
  if (!CLOUDINARY_CLOUD_NAME) {
    return ''; // Cloudinary not configured
  }

  const transformConfig = transformation
    ? IMAGE_TRANSFORMATIONS[transformation]
    : {};

  return cloudinary.url(publicId, transformConfig);
}

/**
 * Check if Cloudinary is properly configured
 * 
 * @returns true if credentials exist
 */
export function isCloudinaryConfigured(): boolean {
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

// Export configured cloudinary instance
export default cloudinary;
