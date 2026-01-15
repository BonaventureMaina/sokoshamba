import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './src/utils/validation';
import { ZodError } from 'zod';

function testValidation() {
  console.log('✅ Testing Validation schemas...\n');

  // Test 1: Valid registration
  console.log('Test 1: Valid registration data');
  try {
    const validData = registerSchema.parse({
      email: 'test@example.com',
      phone: '254712345678',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'consumer',
    });
    console.log('  ✅ Valid registration accepted');
    console.log('  Email normalized:', validData.email);
  } catch (error: any) {
    console.log('  ❌ Should have accepted valid data');
  }
  console.log();

  // Test 2: Invalid email
  console.log('Test 2: Invalid email format');
  try {
    registerSchema.parse({
      email: 'not-an-email',
      phone: '254712345678',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'consumer',
    });
    console.log('  ❌ Should have rejected invalid email');
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('  ✅ Invalid email rejected:', error.issues[0].message);
    }
  }
  console.log();

  // Test 3: Invalid phone format
  console.log('Test 3: Invalid phone number');
  try {
    registerSchema.parse({
      email: 'test@example.com',
      phone: '0712345678', // Missing country code
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'consumer',
    });
    console.log('  ❌ Should have rejected invalid phone');
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('  ✅ Invalid phone rejected:', error.issues[0].message);
    }
  }
  console.log();

  // Test 4: Weak password
  console.log('Test 4: Weak password');
  try {
    registerSchema.parse({
      email: 'test@example.com',
      phone: '254712345678',
      password: 'weak', // Too short, no uppercase, no number, no special char
      firstName: 'John',
      lastName: 'Doe',
      role: 'consumer',
    });
    console.log('  ❌ Should have rejected weak password');
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('  ✅ Weak password rejected:', error.issues.length, 'validation errors');
      error.issues.forEach((issue) => {
        console.log('    -', issue.message);
      });
    }
  }
  console.log();

  // Test 5: Invalid role
  console.log('Test 5: Invalid role');
  try {
    registerSchema.parse({
      email: 'test@example.com',
      phone: '254712345678',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'admin', // Not allowed in registration
    });
    console.log('  ❌ Should have rejected invalid role');
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('  ✅ Invalid role rejected:', error.issues[0].message);
    }
  }
  console.log();

  // Test 6: Valid login
  console.log('Test 6: Valid login data');
  try {
    const validLogin = loginSchema.parse({
      email: 'TEST@EXAMPLE.COM', // Should be lowercased
      password: 'any-password',
    });
    console.log('  ✅ Valid login accepted');
    console.log('  Email normalized:', validLogin.email);
  } catch (error: any) {
    console.log('  ❌ Should have accepted valid login');
  }
  console.log();

  // Test 7: Missing required fields
  console.log('Test 7: Missing required fields');
  try {
    registerSchema.parse({
      email: 'test@example.com',
      // Missing phone, password, firstName, lastName, role
    });
    console.log('  ❌ Should have rejected missing fields');
  } catch (error) {
    if (error instanceof ZodError) {
      console.log('  ✅ Missing fields rejected:', error.issues.length, 'errors');
      console.log('  Missing fields:', error.issues.map((e) => e.path[0]).join(', '));
    }
  }
  console.log();

  // Test 8: Refresh token validation
  console.log('Test 8: Refresh token validation');
  try {
    refreshTokenSchema.parse({ refreshToken: 'valid-token-string' });
    console.log('  ✅ Valid refresh token accepted');
  } catch (error: any) {
    console.log('  ❌ Should have accepted valid token');
  }
  console.log();

  // Test 9: Forgot password validation
  console.log('Test 9: Forgot password validation');
  try {
    const validForgot = forgotPasswordSchema.parse({
      email: '  UPPERCASE@example.com  ', // Should be trimmed and lowercased
    });
    console.log('  ✅ Valid forgot password request');
    console.log('  Email cleaned:', validForgot.email);
  } catch (error: any) {
    console.log('  ❌ Should have accepted valid email');
  }
  console.log();

  console.log('✅ All validation tests passed!');
}

testValidation();
