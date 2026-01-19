import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../utils/errors';
import type { CreateAddressInput, UpdateAddressInput } from '../utils/validation';

const prisma = new PrismaClient();

// ============================================================================
// GET USER ADDRESSES
// ============================================================================

/**
 * Get all addresses for a user
 * GET /api/users/:userId/addresses
 */
export async function getUserAddresses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' }, // Default address first
        { createdAt: 'desc' }, // Then newest first
      ],
    });

    res.status(200).json({
      success: true,
      data: { addresses },
      meta: {
        timestamp: new Date().toISOString(),
        count: addresses.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// CREATE ADDRESS
// ============================================================================

/**
 * Create new address for user
 * POST /api/users/:userId/addresses
 */
export async function createAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    const addressData = req.body as CreateAddressInput;

    // If this is being set as default, unset other defaults first
    if (addressData.isDefault) {
      await prisma.address.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // If this is the user's first address, make it default
    const existingAddressCount = await prisma.address.count({
      where: { userId },
    });

    const isFirstAddress = existingAddressCount === 0;

    // Create address
    const address = await prisma.address.create({
      data: {
        ...addressData,
        userId,
        isDefault: addressData.isDefault || isFirstAddress,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: { address },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET SINGLE ADDRESS
// ============================================================================

/**
 * Get single address by ID
 * GET /api/addresses/:id
 */
export async function getAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const address = await prisma.address.findUnique({
      where: { id },
    });

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    res.status(200).json({
      success: true,
      data: { address },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// UPDATE ADDRESS
// ============================================================================

/**
 * Update address
 * PATCH /api/addresses/:id
 */
export async function updateAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateAddressInput;

    // Check if address exists
    const existingAddress = await prisma.address.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existingAddress) {
      throw new NotFoundError('Address not found');
    }

    // If setting as default, unset other defaults for this user
    if (updateData.isDefault) {
      await prisma.address.updateMany({
        where: {
          userId: existingAddress.userId,
          isDefault: true,
          id: { not: id }, // Don't update the current address
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Update address
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: { address: updatedAddress },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// DELETE ADDRESS
// ============================================================================

/**
 * Delete address
 * DELETE /api/addresses/:id
 */
export async function deleteAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Check if address exists
    const address = await prisma.address.findUnique({
      where: { id },
      select: { id: true, userId: true, isDefault: true },
    });

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    // Delete address
    await prisma.address.delete({
      where: { id },
    });

    // If deleted address was default, set another one as default
    if (address.isDefault) {
      const firstAddress = await prisma.address.findFirst({
        where: { userId: address.userId },
        orderBy: { createdAt: 'asc' },
      });

      if (firstAddress) {
        await prisma.address.update({
          where: { id: firstAddress.id },
          data: { isDefault: true },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SET DEFAULT ADDRESS
// ============================================================================

/**
 * Set address as default
 * PATCH /api/addresses/:id/set-default
 */
export async function setDefaultAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Check if address exists
    const address = await prisma.address.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    // Unset other defaults for this user
    await prisma.address.updateMany({
      where: {
        userId: address.userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set this as default
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        isDefault: true,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: { address: updatedAddress },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
