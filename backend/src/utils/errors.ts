// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base API Error class
 * All custom errors extend this
 */
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean; // true = expected error, false = programming error

  constructor(message: string, statusCode: number, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 * Invalid input from client
 */
export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

/**
 * 401 Unauthorized
 * Authentication required or failed
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden
 * Authenticated but not authorized for this resource
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found
 * Resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict
 * Request conflicts with current state (e.g., duplicate email)
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * 422 Unprocessable Entity
 * Validation failed
 */
export class ValidationError extends ApiError {
  errors: Array<{ field: string; message: string }>;

  constructor(
    message: string = 'Validation failed',
    errors: Array<{ field: string; message: string }> = []
  ) {
    super(message, 422);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * 429 Too Many Requests
 * Rate limit exceeded
 */
export class TooManyRequestsError extends ApiError {
  retryAfter?: number; // Seconds until retry allowed

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429);
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 Internal Server Error
 * Unexpected server error
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false); // Not operational = programming error
    this.name = 'InternalServerError';
  }
}

/**
 * 503 Service Unavailable
 * External service (database, Redis, M-Pesa) is down
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

// ============================================================================
// ERROR RESPONSE FORMATTERS
// ============================================================================

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Format error for API response
 * 
 * @param error - Error object
 * @param requestId - Optional request ID for tracking
 * @returns Formatted error response
 */
export function formatErrorResponse(
  error: Error | ApiError,
  requestId?: string
): ErrorResponse {
  const isApiError = error instanceof ApiError;

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  let errorCode = 'INTERNAL_SERVER_ERROR';
  let errorMessage = 'An unexpected error occurred';
  let details: any = undefined;

  if (isApiError) {
    // Custom API errors - safe to expose
    errorCode = error.name.replace('Error', '').toUpperCase();
    errorMessage = error.message;

    // Add validation errors if present
    if (error instanceof ValidationError && error.errors.length > 0) {
      details = error.errors;
    }

    // Add retry-after for rate limiting
    if (error instanceof TooManyRequestsError && error.retryAfter) {
      details = { retryAfter: error.retryAfter };
    }
  } else {
    // Generic error - only expose in development
    if (isDevelopment) {
      errorMessage = error.message;
      details = error.stack;
    }
  }

  return {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Check if error should be logged
 * Operational errors (bad input) = log as warnings
 * Programming errors (bugs) = log as errors
 * 
 * @param error - Error object
 * @returns true if should be logged as error
 */
export function shouldLogError(error: Error | ApiError): boolean {
  if (error instanceof ApiError) {
    return !error.isOperational;
  }
  return true; // Unknown errors should be logged
}

/**
 * Get HTTP status code from error
 * 
 * @param error - Error object
 * @returns HTTP status code
 */
export function getStatusCode(error: Error | ApiError): number {
  if (error instanceof ApiError) {
    return error.statusCode;
  }
  return 500; // Default to internal server error
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create validation error from multiple field errors
 * 
 * @param fieldErrors - Array of field-level errors
 * @returns ValidationError instance
 */
export function createValidationError(
  fieldErrors: Array<{ field: string; message: string }>
): ValidationError {
  return new ValidationError(
    `Validation failed: ${fieldErrors.map(e => e.field).join(', ')}`,
    fieldErrors
  );
}

/**
 * Check if error is a database unique constraint violation
 * 
 * @param error - Error object
 * @returns true if unique constraint violation
 */
export function isDatabaseUniqueViolation(error: any): boolean {
  // Prisma unique constraint error code
  if (error.code === 'P2002') {
    return true;
  }

  // PostgreSQL unique violation error code
  if (error.code === '23505') {
    return true;
  }

  return false;
}

/**
 * Extract duplicate field from database error
 * 
 * @param error - Database error
 * @returns Field name or null
 */
export function getUniqueConstraintField(error: any): string | null {
  // Prisma error includes target field
  if (error.meta && error.meta.target) {
    const target = error.meta.target;
    if (Array.isArray(target)) {
      return target[0];
    }
    return target;
  }

  // Try to parse from error message
  const match = error.message?.match(/constraint\s+"[^"]+_([^"]+)_key"/i);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Convert database error to user-friendly ConflictError
 * 
 * @param error - Database error
 * @returns ConflictError with helpful message
 */
export function handleDatabaseUniqueViolation(error: any): ConflictError {
  const field = getUniqueConstraintField(error);
  
  if (field === 'email') {
    return new ConflictError('Email address is already registered');
  }
  
  if (field === 'phone') {
    return new ConflictError('Phone number is already registered');
  }

  return new ConflictError(`This ${field || 'value'} already exists`);
}
