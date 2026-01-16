import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';
import {
  validate,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validation';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (consumer or farmer)
 * @access  Public
 */
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(register)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(login)
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(refreshToken)
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(forgotPassword)
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(resetPassword)
);

// ============================================================================
// PROTECTED ROUTES (authentication required)
// ============================================================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout (invalidate token on client)
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(logout)
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user's profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(getCurrentUser)
);

export default router;