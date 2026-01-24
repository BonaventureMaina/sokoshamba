import { Router } from 'express';
import {
  listCategories,
  getCategoryBySlug,
  getCategoryProducts,
  createCategory,
  updateCategory,
} from '../controllers/category.controller';
import {
  validate,
  createCategorySchema,
  updateCategorySchema,
} from '../utils/validation';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ============================================================================
// CATEGORY LISTING & RETRIEVAL
// ============================================================================

/**
 * @route   GET /api/categories
 * @desc    List all categories with hierarchical structure
 * @access  Public
 * @query   includeInactive (optional, admin only)
 */
router.get(
  '/',
  asyncHandler(listCategories)
);

/**
 * @route   GET /api/categories/:slug
 * @desc    Get single category by slug
 * @access  Public
 */
router.get(
  '/:slug',
  asyncHandler(getCategoryBySlug)
);

/**
 * @route   GET /api/categories/:slug/products
 * @desc    Get all products in a category
 * @access  Public
 * @query   page, limit, sortBy
 */
router.get(
  '/:slug/products',
  asyncHandler(getCategoryProducts)
);

// ============================================================================
// CATEGORY MANAGEMENT (ADMIN ONLY)
// ============================================================================

/**
 * @route   POST /api/categories
 * @desc    Create new category
 * @access  Private (admin only)
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  validate(createCategorySchema),
  asyncHandler(createCategory)
);

/**
 * @route   PATCH /api/categories/:id
 * @desc    Update category
 * @access  Private (admin only)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['admin']),
  validate(updateCategorySchema),
  asyncHandler(updateCategory)
);

export default router;
