import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ConflictError,
  isDatabaseUniqueViolation,
  handleDatabaseUniqueViolation,
} from '../utils/errors';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../utils/validation';

const prisma = new PrismaClient();

// ============================================================================
// LIST CATEGORIES
// ============================================================================

/**
 * List all categories with optional hierarchical structure
 * GET /api/categories
 */
export async function listCategories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { includeInactive } = req.query;

    // Build where clause
    const where: any = {};

    // Only show active categories by default
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    // Get all categories with their subcategories and product counts
    const categories = await prisma.category.findMany({
      where,
      include: {
        subCategories: {
          where: includeInactive === 'true' ? {} : { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    res.status(200).json({
      success: true,
      data: { categories },
      meta: {
        timestamp: new Date().toISOString(),
        count: categories.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET CATEGORY BY SLUG
// ============================================================================

/**
 * Get single category by slug
 * GET /api/categories/:slug
 */
export async function getCategoryBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: { slug: slug as string },
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        subCategories: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    res.status(200).json({
      success: true,
      data: { category },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET CATEGORY PRODUCTS
// ============================================================================

/**
 * Get all products in a category
 * GET /api/categories/:slug/products
 */
export async function getCategoryProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { slug } = req.params;
    const {
      page = '1',
      limit = '20',
      sortBy = 'newest',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get category
    const category = await prisma.category.findUnique({
      where: { slug: slug as string },
      select: { id: true, name: true },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Build orderBy clause
    let orderBy: any = {};
    switch (sortBy) {
      case 'price_asc':
        orderBy = { priceKsh: 'asc' };
        break;
      case 'price_desc':
        orderBy = { priceKsh: 'desc' };
        break;
      case 'rating':
        orderBy = { ratingAvg: 'desc' };
        break;
      case 'popular':
        orderBy = { totalSold: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Get products in category
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          categoryId: category.id,
          isAvailable: true,
        },
        skip,
        take: limitNum,
        orderBy,
        include: {
          farmer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              farmerProfile: {
                select: {
                  id: true,
                  farmName: true,
                  locationCounty: true,
                  isVerified: true,
                  ratingAvg: true,
                },
              },
            },
          },
        },
      }),
      prisma.product.count({
        where: {
          categoryId: category.id,
          isAvailable: true,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        category: {
          id: category.id,
          name: category.name,
        },
        products,
      },
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
// CREATE CATEGORY
// ============================================================================

/**
 * Create new category
 * POST /api/categories
 * Requires: authenticate + admin role
 */
export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const categoryData = req.body as CreateCategoryInput;

    // If parent category specified, verify it exists
    if (categoryData.parentCategoryId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: categoryData.parentCategoryId },
      });

      if (!parentCategory) {
        throw new NotFoundError('Parent category not found');
      }
    }

    // Create category
    let category;
    try {
      category = await prisma.category.create({
        data: categoryData,
        include: {
          parentCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
    } catch (error: any) {
      // Handle unique constraint violations (duplicate name/slug)
      if (isDatabaseUniqueViolation(error)) {
        throw handleDatabaseUniqueViolation(error);
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// UPDATE CATEGORY
// ============================================================================

/**
 * Update category
 * PATCH /api/categories/:id
 * Requires: authenticate + admin role
 */
export async function updateCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateCategoryInput;

    // Verify category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: id as string },
      select: { id: true },
    });

    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    // If updating parent category, verify it exists
    if (updateData.parentCategoryId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: updateData.parentCategoryId },
      });

      if (!parentCategory) {
        throw new NotFoundError('Parent category not found');
      }

      // Prevent circular reference (category can't be its own parent)
      if (updateData.parentCategoryId === id) {
        throw new ConflictError('Category cannot be its own parent');
      }
    }

    // Update category
    let updatedCategory;
    try {
      updatedCategory = await prisma.category.update({
        where: { id: id as string },
        data: updateData,
        include: {
          parentCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          subCategories: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
    } catch (error: any) {
      // Handle unique constraint violations
      if (isDatabaseUniqueViolation(error)) {
        throw handleDatabaseUniqueViolation(error);
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category: updatedCategory },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
