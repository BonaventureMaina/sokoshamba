import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  uploadProfileImage,
  deleteProfileImage,
} from '../controllers/user.controller';
import { validate, updateUserSchema } from '../utils/validation';
import { authenticate, requireOwnership } from '../middleware/auth';
import { uploadProfileImage as uploadProfileImageMiddleware, handleUploadError } from '../middleware/upload';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ============================================================================
// USER PROFILE ROUTES
// ============================================================================

/**
 * @route   GET /api/users/:id
 * @desc    Get user profile by ID
 * @access  Public (can view any user's public profile)
 */
router.get(
  '/:id',
  asyncHandler(getUserProfile)
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user profile
 * @access  Private (user must own the profile or be admin)
 */
router.patch(
  '/:id',
  authenticate,
  requireOwnership('id'),
  validate(updateUserSchema),
  asyncHandler(updateUserProfile)
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user account
 * @access  Private (user must own the account or be admin)
 */
router.delete(
  '/:id',
  authenticate,
  requireOwnership('id'),
  asyncHandler(deleteUserAccount)
);

// ============================================================================
// PROFILE IMAGE ROUTES
// ============================================================================

/**
 * @route   POST /api/users/:id/profile-image
 * @desc    Upload/update profile image
 * @access  Private (user must own the profile)
 */
router.post(
  '/:id/profile-image',
  authenticate,
  requireOwnership('id'),
  uploadProfileImageMiddleware,
  handleUploadError,
  asyncHandler(uploadProfileImage)
);

/**
 * @route   DELETE /api/users/:id/profile-image
 * @desc    Delete profile image
 * @access  Private (user must own the profile)
 */
router.delete(
  '/:id/profile-image',
  authenticate,
  requireOwnership('id'),
  asyncHandler(deleteProfileImage)
);

export default router;
