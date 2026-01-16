import { Request, Response, NextFunction } from 'express';
import {
  ApiError,
  formatErrorResponse,
  getStatusCode,
  shouldLogError,
  isDatabaseUniqueViolation,
  handleDatabaseUniqueViolation,
} from '../utils/errors';

// ============================================================================
// REQUEST ID MIDDLEWARE
// ============================================================================

/**
 * Generate or extract request ID for tracking
 * Adds req.id for use in error responses and logging
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate new one
  const id =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Store in request object (need to extend Express.Request type)
  (req as any).id = id;

  // Send back in response header
  res.setHeader('X-Request-Id', id);

  next();
}

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

/**
 * Global error handler middleware
 * Must be registered LAST in middleware chain
 * Catches all errors from routes and other middleware
 * 
 * @param err - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function (unused but required for Express error handler signature)
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract request ID if available
  const requestId = (req as any).id;

  // Handle Prisma unique constraint violations
  if (isDatabaseUniqueViolation(err)) {
    err = handleDatabaseUniqueViolation(err);
  }

  // Get HTTP status code
  const statusCode = getStatusCode(err);

  // Format error response
  const errorResponse = formatErrorResponse(err, requestId);

  // Log error
  if (shouldLogError(err)) {
    // Programming error - log as error with stack trace
    console.error('❌ ERROR:', {
      requestId,
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
    });
  } else {
    // Operational error - log as warning (less verbose)
    console.warn('⚠️  WARNING:', {
      requestId,
      error: err.message,
      url: req.originalUrl,
      method: req.method,
      statusCode,
    });
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// ============================================================================
// 404 NOT FOUND HANDLER
// ============================================================================

/**
 * 404 handler for routes that don't exist
 * Must be registered BEFORE error handler but AFTER all routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (req as any).id,
    },
  });
}

// ============================================================================
// ASYNC HANDLER WRAPPER
// ============================================================================

/**
 * Wrapper for async route handlers
 * Automatically catches rejected promises and passes to error handler
 * Without this, you need try/catch in every async route
 * 
 * @param fn - Async route handler function
 * @returns Express middleware function
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await prisma.user.findMany();
 *   res.json({ success: true, data: users });
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}