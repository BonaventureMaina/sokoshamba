import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  isDatabaseUniqueViolation,
  handleDatabaseUniqueViolation,
} from '../utils/errors';
import type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
} from '../utils/validation';

const prisma = new PrismaClient();

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register a new user (consumer or farmer)
 * POST /api/auth/register
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, phone, password, firstName, lastName, role } =
      req.body as RegisterInput;

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          phone,
          passwordHash,
          firstName,
          lastName,
          role,
          isVerified: false, // Email verification required
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violations (duplicate email/phone)
      if (isDatabaseUniqueViolation(error)) {
        throw handleDatabaseUniqueViolation(error);
      }
      throw error;
    }

    // Create farmer profile if role is farmer
    if (role === 'farmer') {
      await prisma.farmerProfile.create({
        data: {
          userId: user.id,
          isVerified: false, // Admin verification required
        },
      });
    }

    // Generate tokens (user.role from Prisma is string, needs type assertion)
    const tokens = generateTokenPair(
      user.id,
      user.email,
      user.role as 'admin' | 'consumer' | 'farmer'
    );

    // TODO: Send verification email
    // await sendVerificationEmail(user.email, user.firstName);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user,
        tokens,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Login user with email and password
 * POST /api/auth/login
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens (user.role from Prisma is string, needs type assertion)
    const tokens = generateTokenPair(
      user.id,
      user.email,
      user.role as 'admin' | 'consumer' | 'farmer'
    );

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id as string },
      data: { lastLoginAt: new Date() },
    });

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        tokens,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Logout user (client-side token deletion)
 * POST /api/auth/logout
 * 
 * Note: JWT tokens are stateless, so logout is primarily client-side.
 * For production, implement token blacklisting with Redis.
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // TODO: Add token to Redis blacklist
    // await redis.sadd('token-blacklist', req.headers.authorization);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// REFRESH TOKEN
// ============================================================================

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshTokenInput;

    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Load user from database (ensure still exists and active)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated');
    }

    // Generate new token pair (user.role from Prisma is string, needs type assertion)
    const tokens = generateTokenPair(
      user.id,
      user.email,
      user.role as 'admin' | 'consumer' | 'farmer'
    );

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET CURRENT USER
// ============================================================================

/**
 * Get current authenticated user's profile
 * GET /api/auth/me
 * Requires: authenticate middleware
 */
export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // User is already attached by authenticate middleware
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Load full user details including farmer profile if applicable
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        isActive: true,
        profileImageUrl: true,
        createdAt: true,
        farmerProfile: {
          select: {
            id: true,
            farmName: true,
            bio: true,
            locationCounty: true,
            locationSubcounty: true,
            certifications: true,
            isVerified: true,
            ratingAvg: true,
            totalOrders: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.status(200).json({
      success: true,
      data: { user },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// PASSWORD RESET REQUEST (TODO: Implement with email)
// ============================================================================

/**
 * Request password reset email
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true },
    });

    // Always return success (don't reveal if email exists)
    // This prevents email enumeration attacks
    res.status(200).json({
      success: true,
      message: 'If that email exists, a password reset link has been sent',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });

    // Only send email if user exists
    if (user) {
      // TODO: Generate reset token, store in Redis with expiration
      // TODO: Send password reset email
      // const resetToken = generateSecureToken();
      // await redis.setex(`reset:${resetToken}`, 3600, user.id);
      // await sendPasswordResetEmail(user.email, resetToken);
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, password } = req.body;

    // TODO: Verify token from Redis
    // const userId = await redis.get(`reset:${token}`);
    // if (!userId) {
    //   throw new BadRequestError('Invalid or expired reset token');
    // }

    // For now, throw not implemented
    throw new BadRequestError('Password reset not yet implemented');

    // TODO: Hash new password and update user
    // const passwordHash = await hashPassword(password);
    // await prisma.user.update({
    //   where: { id: userId },
    //   data: { passwordHash },
    // });
    // await redis.del(`reset:${token}`);
  } catch (error) {
    next(error);
  }
}