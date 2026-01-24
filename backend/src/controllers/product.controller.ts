import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { uploadMultipleImagesFromBuffer } from '../utils/uploadFromBuffer';
import { deleteImageByUrl } from '../utils/upload';
import { CLOUDINARY_FOLDERS } from '../config/cloudinary';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
} from '../utils/validation';

const prisma = new PrismaClient();

// ============================================================================
// LIST PRODUCTS WITH FILTERS
// ============================================================================

/**
 * List products with advanced filtering
 * GET /api/products
 * Query params: page, limit, categoryId, farmerId, minPrice, maxPrice,
 *               isOrganic, county, search, sortBy
 */
export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      page,
      limit,
      categoryId,
      farmerId,
      minPrice,
      maxPrice,
      isOrganic,
      isAvailable,
      county,
      search,
      sortBy,
    } = req.query as unknown as ProductQueryInput;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Filter by farmer
    if (farmerId) {
      where.farmerId = farmerId;
    }

    // Filter by price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.priceKsh = {};
      if (minPrice !== undefined) {
        where.priceKsh.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.priceKsh.lte = maxPrice;
      }
    }

    // Filter by organic
    if (isOrganic !== undefined) {
      where.isOrganic = isOrganic;
    }

    // Filter by availability
    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable;
    } else {
      // Default: only show available products
      where.isAvailable = true;
    }

    // Filter by farmer location (county)
    if (county) {
      where.farmer = {
        farmerProfile: {
          locationCounty: {
            equals: county,
            mode: 'insensitive',
          },
        },
      };
    }

    // Search by product name or tags
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
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

    // Execute query with pagination
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
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
                  locationSubcounty: true,
                  isVerified: true,
                  ratingAvg: true,
                },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: { products },
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
// CREATE PRODUCT
// ============================================================================

/**
 * Create new product
 * POST /api/products
 * Requires: authenticate + farmer role
 */
export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    const productData = req.body as CreateProductInput;

    // Verify user is a farmer
    if (req.user.role !== 'farmer') {
      throw new ForbiddenError('Only farmers can create products');
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: productData.categoryId },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        ...productData,
        farmerId: req.user.id,
        images: [], // Empty array initially, images added via separate endpoint
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        farmer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            farmerProfile: {
              select: {
                farmName: true,
                locationCounty: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET SINGLE PRODUCT
// ============================================================================

/**
 * Get product by ID
 * GET /api/products/:id
 */
export async function getProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: id as string },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
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
                bio: true,
                locationCounty: true,
                locationSubcounty: true,
                isVerified: true,
                ratingAvg: true,
                totalOrders: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    res.status(200).json({
      success: true,
      data: { product },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// UPDATE PRODUCT
// ============================================================================

/**
 * Update product
 * PATCH /api/products/:id
 * Requires: authenticate + farmer role + ownership
 */
export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateProductInput;

    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    // Get existing product
    const existingProduct = await prisma.product.findUnique({
      where: { id: id as string },
      select: { id: true, farmerId: true },
    });

    if (!existingProduct) {
      throw new NotFoundError('Product not found');
    }

    // Verify ownership (farmer must own the product)
    if (req.user.id !== existingProduct.farmerId && req.user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to update this product');
    }

    // If updating category, verify it exists
    if (updateData.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: updateData.categoryId },
      });

      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: id as string },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        farmer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updatedProduct },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// DELETE PRODUCT
// ============================================================================

/**
 * Delete product
 * DELETE /api/products/:id
 * Requires: authenticate + farmer role + ownership
 */
export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    // Get product with images
    const product = await prisma.product.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        farmerId: true,
        images: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify ownership
    if (req.user.id !== product.farmerId && req.user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to delete this product');
    }

    // Delete all product images from Cloudinary
    if (product.images && Array.isArray(product.images)) {
      for (const imageUrl of product.images as string[]) {
        await deleteImageByUrl(imageUrl);
      }
    }

    // Delete product
    await prisma.product.delete({
      where: { id: id as string },
    });

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// UPLOAD PRODUCT IMAGES
// ============================================================================

/**
 * Upload multiple product images
 * POST /api/products/:id/images
 * Requires: authenticate + farmer role + ownership + multer uploadMultiple middleware
 */
export async function uploadProductImages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    // Check if files were uploaded
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new NotFoundError('No image files provided');
    }

    // Get product
    const product = await prisma.product.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        farmerId: true,
        images: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify ownership
    if (req.user.id !== product.farmerId && req.user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to upload images for this product');
    }

    // Upload images to Cloudinary
    const uploadResults = await uploadMultipleImagesFromBuffer(
      req.files as Express.Multer.File[],
      {
        folder: CLOUDINARY_FOLDERS.PRODUCT_IMAGES,
        transformation: 'PRODUCT_FULL',
      }
    );

    // Extract URLs from upload results
    const newImageUrls = uploadResults.map(result => result.secureUrl);

    // Get existing images
    const existingImages = (product.images as string[]) || [];

    // Combine existing and new images (max 5 total)
    const allImages = [...existingImages, ...newImageUrls].slice(0, 5);

    // Update product with new images
    const updatedProduct = await prisma.product.update({
      where: { id: id as string },
      data: {
        images: allImages,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        images: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: `${newImageUrls.length} image(s) uploaded successfully`,
      data: {
        product: updatedProduct,
        uploadedImages: uploadResults.map(result => ({
          url: result.secureUrl,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        })),
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
// DELETE PRODUCT IMAGE
// ============================================================================

/**
 * Delete single product image
 * DELETE /api/products/:id/images/:imageIndex
 * Requires: authenticate + farmer role + ownership
 */
export async function deleteProductImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, imageIndex } = req.params;
    const index = parseInt(imageIndex as string, 10);

    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    if (isNaN(index) || index < 0) {
      throw new NotFoundError('Invalid image index');
    }

    // Get product
    const product = await prisma.product.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        farmerId: true,
        images: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify ownership
    if (req.user.id !== product.farmerId && req.user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to delete images from this product');
    }

    // Get current images
    const images = (product.images as string[]) || [];

    if (index >= images.length) {
      throw new NotFoundError('Image not found at the specified index');
    }

    // Get the image URL to delete
    const imageUrl = images[index];

    // Delete from Cloudinary
    await deleteImageByUrl(imageUrl);

    // Remove from array
    const updatedImages = images.filter((_, i) => i !== index);

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: id as string },
      data: {
        images: updatedImages,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        images: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: { product: updatedProduct },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
