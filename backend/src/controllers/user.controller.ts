import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  isDatabaseUniqueViolation,
  handleDatabaseUniqueViolation,
} from '../utils/errors';
import { uploadImageFromBuffer } from '../utils/uploadFromBuffer';
import { deleteImageByUrl } from '../utils/upload';
import { CLOUDINARY_FOLDERS } from '../config/cloudinary';
import type { UpdateUserInput } from '../utils/validation';

const prisma = new PrismaClient();

// ============================================================================
// GET USER PROFILE
// ============================================================================

/**
 * Get user profile by ID
 * GET /api/users/:id
 */
export async function getUserProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Find user with farmer profile if applicable
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        profileImageUrl: true,
        createdAt: true,
        farmerProfile: {
          select: {
            id: true,
            farmName: true,
            bio: true,
            locationCounty: true,
            locationSubcounty: true,
            locationDetails: true,
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
// UPDATE USER PROFILE
// ============================================================================

/**
 * Update user profile
 * PATCH /api/users/:id
 * Requires: authenticate + ownership
 */
export async function updateUserProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateUserInput;

    // Verify user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Update user
    let updatedUser;
    try {
      updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          profileImageUrl: true,
          isVerified: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violations (duplicate phone)
      if (isDatabaseUniqueViolation(error)) {
        throw handleDatabaseUniqueViolation(error);
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// DELETE USER ACCOUNT
// ============================================================================

/**
 * Delete user account
 * DELETE /api/users/:id
 * Requires: authenticate + ownership
 */
export async function deleteUserAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        profileImageUrl: true,
        farmerProfile: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Delete profile image from Cloudinary if exists
    if (user.profileImageUrl) {
      await deleteImageByUrl(user.profileImageUrl);
    }

    // Delete user (cascades to farmer_profile, addresses, etc.)
    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// UPLOAD PROFILE IMAGE
// ============================================================================

/**
 * Upload/update profile image
 * POST /api/users/:id/profile-image
 * Requires: authenticate + ownership + multer uploadProfileImage middleware
 */
export async function uploadProfileImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      throw new NotFoundError('No image file provided');
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        profileImageUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Upload new image to Cloudinary
    const uploadResult = await uploadImageFromBuffer(req.file.buffer, {
      folder: CLOUDINARY_FOLDERS.PROFILE_IMAGES,
      transformation: 'PROFILE_FULL',
      filename: req.file.originalname,
    });

    // Delete old profile image if exists
    if (user.profileImageUrl) {
      await deleteImageByUrl(user.profileImageUrl);
    }

    // Update user with new image URL
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        profileImageUrl: uploadResult.secureUrl,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        profileImageUrl: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        user: updatedUser,
        upload: {
          url: uploadResult.secureUrl,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
        },
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
// DELETE PROFILE IMAGE
// ============================================================================

/**
 * Delete profile image
 * DELETE /api/users/:id/profile-image
 * Requires: authenticate + ownership
 */
export async function deleteProfileImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Get user with current image
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        profileImageUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.profileImageUrl) {
      throw new NotFoundError('No profile image to delete');
    }

    // Delete from Cloudinary
    await deleteImageByUrl(user.profileImageUrl);

    // Update user record
    await prisma.user.update({
      where: { id },
      data: {
        profileImageUrl: null,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
