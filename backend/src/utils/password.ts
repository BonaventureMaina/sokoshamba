import bcrypt from 'bcrypt';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Number of salt rounds for bcrypt hashing
 * Higher = more secure but slower
 * 10 rounds = ~100ms per hash (good balance for auth)
 * 12 rounds = ~300ms per hash (more secure, use for sensitive systems)
 */
const SALT_ROUNDS = 10;

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash a plain text password using bcrypt
 * 
 * @param password - Plain text password
 * @returns Hashed password string (includes salt)
 * @throws Error if password is empty or hashing fails
 * 
 * @example
 * const hash = await hashPassword('MySecurePass123!');
 * // Returns: $2b$10$N9qo8uLOickgx2ZMRZoMye...
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate input
  if (!password || password.trim().length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  try {
    // bcrypt.hash automatically generates salt and includes it in output
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Password hashing failed:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Hash password synchronously (use only when async is not possible)
 * WARNING: Blocks event loop - prefer async version
 * 
 * @param password - Plain text password
 * @returns Hashed password string
 */
export function hashPasswordSync(password: string): string {
  if (!password || password.trim().length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  return bcrypt.hashSync(password, SALT_ROUNDS);
}

// ============================================================================
// PASSWORD VERIFICATION
// ============================================================================

/**
 * Compare a plain text password with a hashed password
 * 
 * @param password - Plain text password to verify
 * @param hash - Previously hashed password from database
 * @returns true if password matches, false otherwise
 * 
 * @example
 * const isValid = await comparePassword('UserInput123', storedHash);
 * if (isValid) {
 *   // Login successful
 * }
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  // Validate inputs
  if (!password || !hash) {
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('Password comparison failed:', error);
    return false; // Don't throw, just return false for security
  }
}

/**
 * Compare password synchronously (use only when async is not possible)
 * WARNING: Blocks event loop - prefer async version
 * 
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns true if match, false otherwise
 */
export function comparePasswordSync(password: string, hash: string): boolean {
  if (!password || !hash) {
    return false;
  }

  try {
    return bcrypt.compareSync(password, hash);
  } catch (error) {
    console.error('Password comparison failed:', error);
    return false;
  }
}

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

/**
 * Validate password strength
 * Returns error message if invalid, null if valid
 * 
 * @param password - Password to validate
 * @returns Error message or null
 * 
 * Rules:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (password.length > 128) {
    return 'Password must not exceed 128 characters';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character';
  }

  return null; // Valid
}

/**
 * Check if password is commonly used (basic check)
 * In production, use a comprehensive list like "Have I Been Pwned"
 * 
 * @param password - Password to check
 * @returns true if commonly used, false otherwise
 */
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password',
    'password123',
    '12345678',
    'qwerty123',
    'abc123',
    'password1',
    '123456789',
    'qwerty',
    '1234567890',
    'admin',
    'admin123',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
    'master',
    'sunshine',
    'princess',
    'football',
    'baseball',
  ];

  const lowerPassword = password.toLowerCase();
  return commonPasswords.some(common => lowerPassword.includes(common));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a secure random password
 * Useful for temporary passwords or password reset
 * 
 * @param length - Password length (default: 16)
 * @returns Random secure password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill rest with random characters
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
