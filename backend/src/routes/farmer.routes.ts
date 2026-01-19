import { Router } from 'express';
import {
  getFarmerProfile,
  updateFarmerProfile,
  listFarmers,
  getFarmerProducts,
  getFarmerReviews,
} from '../controllers/farmer.controller';
import { validate, updateFarmerProfileSchema } from '../utils/validation';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ============================================================================
// FARMER LISTING & SEARCH
// ============================================================================

/**
 * @route   GET /api/farmers
 * @desc    List all farmers with optional filters
 * @access  Public
 * @query   page, limit, county, verified, search
 */
router.get(
  '/',
  asyncHandler(listFarmers)
);

// ============================================================================
// FARMER PROFILE ROUTES
// ============================================================================

/**
 * @route   GET /api/farmers/:id
 * @desc    Get farmer profile by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(getFarmerProfile)
);

/**
 * @route   PATCH /api/farmers/:id
 * @desc    Update farmer profile
 * @access  Private (farmer must own the profile or be admin)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['farmer', 'admin']),
  validate(updateFarmerProfileSchema),
  asyncHandler(updateFarmerProfile)
);

// ============================================================================
// FARMER PRODUCTS & REVIEWS
// ============================================================================

/**
 * @route   GET /api/farmers/:id/products
 * @desc    Get all products for a farmer
 * @access  Public
 */
router.get(
  '/:id/products',
  asyncHandler(getFarmerProducts)
);

/**
 * @route   GET /api/farmers/:id/reviews
 * @desc    Get all reviews for a farmer
 * @access  Public
 * @query   page, limit
 */
router.get(
  '/:id/reviews',
  asyncHandler(getFarmerReviews)
);

export default router;
