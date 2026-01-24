import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';

// ============================================================================
// REUSABLE FIELD VALIDATORS
// ============================================================================

/**
 * Reusable email validation with preprocessing
 * Trims and lowercases BEFORE email format validation
 */
const emailField = z
  .string()
  .min(1, 'Email is required')
  .transform((val) => val.trim().toLowerCase())
  .pipe(z.string().email('Invalid email format'));

/**
 * Reusable phone validation
 */
const phoneField = z
  .string()
  .min(1, 'Phone number is required')
  .regex(/^254[17]\d{8}$/, 'Phone must be valid Kenyan format (254XXXXXXXXX)')
  .trim();

/**
 * Reusable password validation
 */
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character');

// ============================================================================
// AUTHENTICATION VALIDATION
// ============================================================================

/**
 * User registration validation
 */
export const registerSchema = z.object({
  email: emailField,
  phone: phoneField,
  password: passwordField,
  
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must not exceed 100 characters')
    .trim(),
  
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must not exceed 100 characters')
    .trim(),
  
  role: z
    .enum(['consumer', 'farmer'])
    .refine((val) => ['consumer', 'farmer'].includes(val), {
      message: 'Role must be either "consumer" or "farmer"',
    }),
});

/**
 * User login validation
 */
export const loginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, 'Password is required'),
});

/**
 * Refresh token validation
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'Refresh token is required'),
});

/**
 * Password reset request validation
 */
export const forgotPasswordSchema = z.object({
  email: emailField,
});

/**
 * Password reset validation
 */
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, 'Reset token is required'),
  
  password: passwordField,
});

/**
 * Email verification validation
 */
export const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(1, 'Verification token is required'),
});

/**
 * Change password validation (for authenticated users)
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  
  newPassword: passwordField,
});

// ============================================================================
// USER PROFILE VALIDATION
// ============================================================================

/**
 * Update user profile validation
 */
export const updateUserSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name must not exceed 100 characters')
    .trim()
    .optional(),
  
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name must not exceed 100 characters')
    .trim()
    .optional(),
  
  phone: phoneField.optional(),
});

/**
 * Update farmer profile validation
 */
export const updateFarmerProfileSchema = z.object({
  farmName: z
    .string()
    .min(2, 'Farm name must be at least 2 characters')
    .max(255, 'Farm name must not exceed 255 characters')
    .trim()
    .optional(),
  
  bio: z
    .string()
    .max(2000, 'Bio must not exceed 2000 characters')
    .trim()
    .optional(),
  
  locationCounty: z
    .string()
    .max(100, 'County name too long')
    .trim()
    .optional(),
  
  locationSubcounty: z
    .string()
    .max(100, 'Subcounty name too long')
    .trim()
    .optional(),
  
  locationDetails: z
    .string()
    .max(500, 'Location details too long')
    .trim()
    .optional(),
  
  locationLat: z
    .number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude')
    .optional(),
  
  locationLng: z
    .number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude')
    .optional(),
});

/**
 * Address validation
 */
export const createAddressSchema = z.object({
  label: z
    .string()
    .max(50, 'Label must not exceed 50 characters')
    .trim()
    .optional(),
  
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must not exceed 255 characters')
    .trim(),
  
  phone: phoneField,
  
  county: z
    .string()
    .min(2, 'County is required')
    .max(100, 'County name too long')
    .trim(),
  
  subcounty: z
    .string()
    .max(100, 'Subcounty name too long')
    .trim()
    .optional(),
  
  streetAddress: z
    .string()
    .min(5, 'Street address must be at least 5 characters')
    .trim(),
  
  buildingDetails: z
    .string()
    .max(255, 'Building details too long')
    .trim()
    .optional(),
  
  deliveryInstructions: z
    .string()
    .max(500, 'Delivery instructions too long')
    .trim()
    .optional(),
  
  locationLat: z
    .number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude')
    .optional(),
  
  locationLng: z
    .number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude')
    .optional(),
  
  isDefault: z.boolean().optional(),
});

/**
 * Update address validation (all fields optional)
 */
export const updateAddressSchema = createAddressSchema.partial();

// ============================================================================
// PRODUCT VALIDATION
// ============================================================================

/**
 * Create product validation
 */
export const createProductSchema = z.object({
  categoryId: z
    .string()
    .uuid('Invalid category ID'),
  
  name: z
    .string()
    .min(3, 'Product name must be at least 3 characters')
    .max(255, 'Product name must not exceed 255 characters')
    .trim(),
  
  description: z
    .string()
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),
  
  unit: z
    .string()
    .min(1, 'Unit is required')
    .max(50, 'Unit must not exceed 50 characters')
    .trim(),
  
  unitQuantity: z
    .number()
    .positive('Unit quantity must be positive')
    .default(1),
  
  priceKsh: z
    .number()
    .positive('Price must be positive'),
  
  stockQuantity: z
    .number()
    .int('Stock quantity must be an integer')
    .nonnegative('Stock quantity cannot be negative')
    .default(0),
  
  isOrganic: z
    .boolean()
    .default(false),
  
  isAvailable: z
    .boolean()
    .default(true),
  
  tags: z
    .array(z.string().trim())
    .default([]),
});

/**
 * Update product validation (all fields optional)
 */
export const updateProductSchema = createProductSchema.partial();

/**
 * Product query filters validation
 */
export const productQuerySchema = z.object({
  page: z
    .coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(1),
  
  limit: z
    .coerce
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(20),
  
  categoryId: z
    .string()
    .uuid()
    .optional(),
  
  farmerId: z
    .string()
    .uuid()
    .optional(),
  
  minPrice: z
    .coerce
    .number()
    .nonnegative()
    .optional(),
  
  maxPrice: z
    .coerce
    .number()
    .positive()
    .optional(),
  
  isOrganic: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  
  isAvailable: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  
  county: z
    .string()
    .trim()
    .optional(),
  
  search: z
    .string()
    .trim()
    .optional(),
  
  sortBy: z
    .enum(['price_asc', 'price_desc', 'rating', 'newest', 'popular'])
    .optional()
    .default('newest'),
});

// ============================================================================
// CATEGORY VALIDATION
// ============================================================================

/**
 * Create category validation
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must not exceed 100 characters')
    .trim(),
  
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must not exceed 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),
  
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .trim()
    .optional(),
  
  iconUrl: z
    .string()
    .url('Invalid icon URL')
    .optional(),
  
  parentCategoryId: z
    .string()
    .uuid('Invalid parent category ID')
    .optional(),
  
  displayOrder: z
    .number()
    .int()
    .nonnegative()
    .default(0),
  
  isActive: z
    .boolean()
    .default(true),
});

/**
 * Update category validation (all fields optional)
 */
export const updateCategorySchema = createCategorySchema.partial();

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Express middleware to validate request body against a Zod schema
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        next(new ValidationError('Validation failed', fieldErrors));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Query validation failed', fieldErrors));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate route parameters
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Parameter validation failed', fieldErrors));
      } else {
        next(error);
      }
    }
  };
}

// ============================================================================
// TYPE EXPORTS (for TypeScript)
// ============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateFarmerProfileInput = z.infer<typeof updateFarmerProfileSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
