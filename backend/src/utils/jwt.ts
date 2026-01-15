import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables (safe to call multiple times)
dotenv.config();

// ============================================================================
// TYPES
// ============================================================================

export interface JwtPayload {
  sub: string; // User ID (subject)
  email: string;
  role: 'consumer' | 'farmer' | 'admin';
  iat?: number; // Issued at (added by jwt.sign)
  exp?: number; // Expiration (added by jwt.sign)
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Validate secrets on module load (fail fast if misconfigured)
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets must be defined in environment variables');
}

if (JWT_SECRET.length < 32 || JWT_REFRESH_SECRET.length < 32) {
  console.warn('⚠️  WARNING: JWT secrets should be at least 32 characters for security');
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate access token (short-lived)
 * 
 * @param userId - User's UUID
 * @param email - User's email
 * @param role - User's role (consumer, farmer, admin)
 * @returns JWT access token string
 */
export function generateAccessToken(
  userId: string,
  email: string,
  role: 'consumer' | 'farmer' | 'admin'
): string {
  const payload: JwtPayload = {
    sub: userId,
    email,
    role,
  };

  return jwt.sign(payload, JWT_SECRET!, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'sokoshamba-api',
    audience: 'sokoshamba-client',
  });
}

/**
 * Generate refresh token (long-lived)
 * 
 * @param userId - User's UUID
 * @param email - User's email
 * @param role - User's role
 * @returns JWT refresh token string
 */
export function generateRefreshToken(
  userId: string,
  email: string,
  role: 'consumer' | 'farmer' | 'admin'
): string {
  const payload: JwtPayload = {
    sub: userId,
    email,
    role,
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET!, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'sokoshamba-api',
    audience: 'sokoshamba-client',
  });
}

/**
 * Generate both access and refresh tokens
 * 
 * @param userId - User's UUID
 * @param email - User's email
 * @param role - User's role
 * @returns Object containing both tokens
 */
export function generateTokenPair(
  userId: string,
  email: string,
  role: 'consumer' | 'farmer' | 'admin'
): TokenPair {
  return {
    accessToken: generateAccessToken(userId, email, role),
    refreshToken: generateRefreshToken(userId, email, role),
  };
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

/**
 * Verify and decode access token
 * 
 * @param token - JWT access token string
 * @returns Decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!, {
      issuer: 'sokoshamba-api',
      audience: 'sokoshamba-client',
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Verify and decode refresh token
 * 
 * @param token - JWT refresh token string
 * @returns Decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET!, {
      issuer: 'sokoshamba-api',
      audience: 'sokoshamba-client',
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Decode token without verification (useful for debugging)
 * WARNING: Do not use for authentication - use verify functions instead
 * 
 * @param token - JWT token string
 * @returns Decoded payload (unverified)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract token from Authorization header
 * 
 * @param authHeader - Authorization header value (e.g., "Bearer token...")
 * @returns Token string or null
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if token is expired (without verifying signature)
 * Useful for client-side token refresh logic
 * 
 * @param token - JWT token string
 * @returns true if expired, false if valid or can't decode
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.exp) {
    return true;
  }

  // JWT exp is in seconds, Date.now() is in milliseconds
  const currentTime = Math.floor(Date.now() / 1000);
  
  return decoded.exp < currentTime;
}
