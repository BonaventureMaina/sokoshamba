import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  verifyAccessToken,
  extractTokenFromHeader,
  JwtPayload,
} from '../utils/jwt';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors';

const prisma = new PrismaClient();

// ============================================================================
// EXTEND EXPRESS REQUEST TYPE
// ============================================================================

// Add user property to Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'consumer' | 'farmer' | 'admin';
        firstName: string;
        lastName: string;
        isVerified: boolean;
        isActive: boolean;
      };
    }
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authenticate user from JWT token
 * Extracts token from Authorization header, verifies it, loads user from DB
 * 
 * @throws UnauthorizedError if token is missing, invalid, or user not found
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw new UnauthorizedError('Authorization token is required');
    }

    // Verify token and extract payload
    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      // Token verification failed (expired, invalid, etc.)
      throw new UnauthorizedError((error as Error).message);
    }

    // Load user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated');
    }

    // Attach user to request for controllers to use
    req.user = user as any; // Type assertion needed due to Prisma select

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Tries to authenticate user but doesn't fail if token is missing
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    // No token = continue as anonymous user
    if (!token) {
      return next();
    }

    // Token present = try to authenticate
    try {
      const payload = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isActive: true,
        },
      });

      if (user && user.isActive) {
        req.user = user as any;
      }
    } catch (error) {
      // Invalid token = continue as anonymous (don't throw error)
      // This is intentional - we're being permissive
    }

    next();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE (ROLE-BASED)
// ============================================================================

/**
 * Authorize user based on role
 * Must be used AFTER authenticate middleware
 * 
 * @param allowedRoles - Array of roles that can access this route
 * @returns Express middleware function
 * 
 * @example
 * router.get('/admin/users', authenticate, authorize(['admin']), getUsers);
 * router.post('/products', authenticate, authorize(['farmer', 'admin']), createProduct);
 */
export function authorize(
  allowedRoles: Array<'consumer' | 'farmer' | 'admin'>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // User must be authenticated first
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require verified email
 * Must be used AFTER authenticate middleware
 * 
 * @throws ForbiddenError if user's email is not verified
 */
export function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!req.user.isVerified) {
      throw new ForbiddenError('Email verification required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if authenticated user owns the resource
 * Compares req.user.id with req.params.userId (or custom param)
 * 
 * @param userIdParam - Name of the route parameter containing user ID (default: 'userId')
 * @returns Express middleware function
 * 
 * @example
 * router.patch('/users/:userId/profile', authenticate, requireOwnership(), updateProfile);
 */
export function requireOwnership(userIdParam: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const resourceUserId = req.params[userIdParam];

      if (!resourceUserId) {
        throw new Error(`Route parameter '${userIdParam}' not found`);
      }

      // Admins can access any user's resources
      if (req.user.role === 'admin') {
        return next();
      }

      // Otherwise, user must own the resource
      if (req.user.id !== resourceUserId) {
        throw new ForbiddenError('You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 * For production, use Redis-based rate limiting
 * 
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Express middleware function
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Use IP address as key (or user ID if authenticated)
      const key = req.user?.id || req.ip || 'anonymous';
      const now = Date.now();

      let record = rateLimitStore.get(key);

      // Reset if window expired
      if (!record || now > record.resetAt) {
        record = { count: 0, resetAt: now + windowMs };
        rateLimitStore.set(key, record);
      }

      record.count++;

      // Check if limit exceeded
      if (record.count > maxRequests) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        throw new Error('Too many requests');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Cleanup rate limit store periodically (every 15 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 15 * 60 * 1000);