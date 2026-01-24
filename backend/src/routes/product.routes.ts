import { Router } from 'express';
import {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
} from '../controllers/product.controller';
import {
  validate,
  validateQuery,
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from '../utils/validation';
import { authenticate, authorize } from '../middleware/auth';
import { uploadProductImages as uploadProductImagesMiddleware, handleUploadError } from '../middleware/upload';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ============================================================================
// PRODUCT LISTING & SEARCH
// ============================================================================

/**
 * @route   GET /api/products
 * @desc    List products with advanced filters
 * @access  Public
 * @query   page, limit, categoryId, farmerId, minPrice, maxPrice,
 *          isOrganic, isAvailable, county, search, sortBy
 */
router.get(
  '/',
  validateQuery(productQuerySchema),
  asyncHandler(listProducts)
);

// ============================================================================
// PRODUCT CRUD OPERATIONS
// ============================================================================

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private (farmer only)
 */
router.post(
  '/',
  authenticate,
  authorize(['farmer', 'admin']),
  validate(createProductSchema),
  asyncHandler(createProduct)
);

/**
 * @route   GET /api/products/:id
 * @desc    Get single product by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(getProduct)
);

/**
 * @route   PATCH /api/products/:id
 * @desc    Update product
 * @access  Private (farmer must own the product or be admin)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['farmer', 'admin']),
  validate(updateProductSchema),
  asyncHandler(updateProduct)
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product
 * @access  Private (farmer must own the product or be admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['farmer', 'admin']),
  asyncHandler(deleteProduct)
);

// ============================================================================
// PRODUCT IMAGE MANAGEMENT
// ============================================================================

/**
 * @route   POST /api/products/:id/images
 * @desc    Upload multiple product images (max 5 total)
 * @access  Private (farmer must own the product)
 */
router.post(
  '/:id/images',
  authenticate,
  authorize(['farmer', 'admin']),
  uploadProductImagesMiddleware,
  handleUploadError,
  asyncHandler(uploadProductImages)
);

/**
 * @route   DELETE /api/products/:id/images/:imageIndex
 * @desc    Delete single product image by index
 * @access  Private (farmer must own the product)
 */
router.delete(
  '/:id/images/:imageIndex',
  authenticate,
  authorize(['farmer', 'admin']),
  asyncHandler(deleteProductImage)
);

export default router;
