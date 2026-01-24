import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import type { UpdateFarmerProfileInput } from '../utils/validation';

const prisma = new PrismaClient();

// ============================================================================
// GET FARMER PROFILE
// ============================================================================

/**
 * Get farmer profile by ID
 * GET /api/farmers/:id
 */
export async function getFarmerProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Get farmer profile with user info and stats
    const farmer = await prisma.farmerProfile.findUnique({
      where: { id: id as string },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profileImageUrl: true,
            isVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!farmer) {
      throw new NotFoundError('Farmer profile not found');
    }

    res.status(200).json({
      success: true,
      data: { farmer },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// UPDATE FARMER PROFILE
// ============================================================================

/**
 * Update farmer profile
 * PATCH /api/farmers/:id
 * Requires: authenticate + farmer role + ownership
 */
export async function updateFarmerProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateFarmerProfileInput;

    // Verify farmer profile exists
    const existingFarmer = await prisma.farmerProfile.findUnique({
      where: { id: id as string },
      select: { id: true, userId: true },
    });

    if (!existingFarmer) {
      throw new NotFoundError('Farmer profile not found');
    }

    // Verify ownership (user must own this farmer profile)
    if (req.user && req.user.id !== existingFarmer.userId && req.user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to update this profile');
    }

    // Update farmer profile
    const updatedFarmer = await prisma.farmerProfile.update({
      where: { id: id as string },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Farmer profile updated successfully',
      data: { farmer: updatedFarmer },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// LIST FARMERS
// ============================================================================

/**
 * List all farmers with optional filters
 * GET /api/farmers
 */
export async function listFarmers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      page = '1',
      limit = '20',
      county,
      verified,
      search,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filters
    const where: any = {};

    // Filter by county
    if (county) {
      where.locationCounty = county;
    }

    // Filter by verified status
    if (verified !== undefined) {
      where.isVerified = verified === 'true';
    }

    // Search by farm name
    if (search) {
      where.farmName = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    // Get farmers with pagination
    const [farmers, total] = await Promise.all([
      prisma.farmerProfile.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              isVerified: true,
            },
          },
        },
        orderBy: [
          { isVerified: 'desc' }, // Verified farmers first
          { ratingAvg: 'desc' },  // Then by rating
          { createdAt: 'desc' },  // Then newest
        ],
      }),
      prisma.farmerProfile.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: { farmers },
      meta: {
        timestamp: new Date().toISOString(),
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET FARMER PRODUCTS
// ============================================================================

/**
 * Get all products for a farmer
 * GET /api/farmers/:id/products
 */
export async function getFarmerProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Verify farmer exists
    const farmer = await prisma.farmerProfile.findUnique({
      where: { id: id as string },
      select: { userId: true },
    });

    if (!farmer) {
      throw new NotFoundError('Farmer profile not found');
    }

    // Get farmer's products
    const products = await prisma.product.findMany({
      where: {
        farmerId: farmer.userId,
        isAvailable: true, // Only show available products
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { ratingAvg: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.status(200).json({
      success: true,
      data: { products },
      meta: {
        timestamp: new Date().toISOString(),
        count: products.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET FARMER REVIEWS
// ============================================================================

/**
 * Get all reviews for a farmer
 * GET /api/farmers/:id/reviews
 */
export async function getFarmerReviews(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Verify farmer exists
    const farmer = await prisma.farmerProfile.findUnique({
      where: { id: id as string },
      select: { userId: true },
    });

    if (!farmer) {
      throw new NotFoundError('Farmer profile not found');
    }

    // Get reviews with pagination
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { farmerId: farmer.userId },
        skip,
        take: limitNum,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.count({ where: { farmerId: farmer.userId } }),
    ]);

    res.status(200).json({
      success: true,
      data: { reviews },
      meta: {
        timestamp: new Date().toISOString(),
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}
