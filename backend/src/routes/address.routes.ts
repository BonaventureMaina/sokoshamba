import { Router } from 'express';
import {
  getUserAddresses,
  createAddress,
  getAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller';
import {
  validate,
  createAddressSchema,
  updateAddressSchema,
} from '../utils/validation';
import { authenticate, requireOwnership } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ============================================================================
// USER ADDRESS ROUTES (nested under /api/users/:userId/addresses)
// ============================================================================

/**
 * @route   GET /api/users/:userId/addresses
 * @desc    Get all addresses for a user
 * @access  Private (user must own the addresses or be admin)
 */
router.get(
  '/users/:userId/addresses',
  authenticate,
  requireOwnership('userId'),
  asyncHandler(getUserAddresses)
);

/**
 * @route   POST /api/users/:userId/addresses
 * @desc    Create new address for user
 * @access  Private (user must own the account)
 */
router.post(
  '/users/:userId/addresses',
  authenticate,
  requireOwnership('userId'),
  validate(createAddressSchema),
  asyncHandler(createAddress)
);

// ============================================================================
// INDIVIDUAL ADDRESS ROUTES (under /api/addresses/:id)
// ============================================================================

/**
 * @route   GET /api/addresses/:id
 * @desc    Get single address by ID
 * @access  Private (user must own the address or be admin)
 * 
 * Note: Ownership check happens in controller by comparing address.userId with req.user.id
 */
router.get(
  '/addresses/:id',
  authenticate,
  asyncHandler(getAddress)
);

/**
 * @route   PATCH /api/addresses/:id
 * @desc    Update address
 * @access  Private (user must own the address)
 */
router.patch(
  '/addresses/:id',
  authenticate,
  validate(updateAddressSchema),
  asyncHandler(updateAddress)
);

/**
 * @route   DELETE /api/addresses/:id
 * @desc    Delete address
 * @access  Private (user must own the address)
 */
router.delete(
  '/addresses/:id',
  authenticate,
  asyncHandler(deleteAddress)
);

/**
 * @route   PATCH /api/addresses/:id/set-default
 * @desc    Set address as default
 * @access  Private (user must own the address)
 */
router.patch(
  '/addresses/:id/set-default',
  authenticate,
  asyncHandler(setDefaultAddress)
);

export default router;
