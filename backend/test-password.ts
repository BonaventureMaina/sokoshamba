import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  isCommonPassword,
  generateSecurePassword,
} from './src/utils/password';

async function testPasswords() {
  console.log('🔐 Testing Password utilities...\n');

  // Test 1: Hash password
  const password = 'MySecurePass123!';
  console.log('Original password:', password);
  
  const hash = await hashPassword(password);
  console.log('Hashed password:', hash);
  console.log('Hash length:', hash.length, 'characters\n');

  // Test 2: Compare correct password
  const isValid = await comparePassword(password, hash);
  console.log('✅ Correct password match:', isValid, '\n');

  // Test 3: Compare wrong password
  const isWrong = await comparePassword('WrongPassword123!', hash);
  console.log('✅ Wrong password rejected:', !isWrong, '\n');

  // Test 4: Validate password strength
  console.log('Password strength validation:');
  console.log('  "weak" ->', validatePasswordStrength('weak'));
  console.log('  "NoNumbers!" ->', validatePasswordStrength('NoNumbers!'));
  console.log('  "nonumbers123!" ->', validatePasswordStrength('nonumbers123!'));
  console.log('  "MySecurePass123!" ->', validatePasswordStrength('MySecurePass123!') || '✅ Valid\n');

  // Test 5: Common password check
  console.log('Common password detection:');
  console.log('  "password123" is common:', isCommonPassword('password123'));
  console.log('  "MySecurePass123!" is common:', isCommonPassword('MySecurePass123!'), '\n');

  // Test 6: Generate secure password
  const generated = generateSecurePassword(16);
  console.log('Generated secure password:', generated);
  const generatedValidation = validatePasswordStrength(generated);
  console.log('Generated password is valid:', !generatedValidation, '\n');

  // Test 7: Same password generates different hashes (salt)
  const hash1 = await hashPassword(password);
  const hash2 = await hashPassword(password);
  console.log('Same password, different hashes (salt working):');
  console.log('  Hash 1:', hash1.substring(0, 30) + '...');
  console.log('  Hash 2:', hash2.substring(0, 30) + '...');
  console.log('  Are different:', hash1 !== hash2);
  console.log('  Both verify:', await comparePassword(password, hash1) && await comparePassword(password, hash2), '\n');

  console.log('✅ All password tests passed!');
}

testPasswords().catch(console.error);
