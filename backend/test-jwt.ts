import { generateTokenPair, verifyAccessToken, verifyRefreshToken } from './src/utils/jwt';

async function testJWT() {
  console.log('🧪 Testing JWT utilities...\n');

  // Generate tokens
  const tokens = generateTokenPair(
    '123e4567-e89b-12d3-a456-426614174000',
    'test@sokoshamba.co.ke',
    'consumer'
  );

  console.log('✅ Generated tokens:');
  console.log('Access Token:', tokens.accessToken.substring(0, 50) + '...');
  console.log('Refresh Token:', tokens.refreshToken.substring(0, 50) + '...\n');

  // Verify access token
  try {
    const accessPayload = verifyAccessToken(tokens.accessToken);
    console.log('✅ Access token verified:');
    console.log('   User ID:', accessPayload.sub);
    console.log('   Email:', accessPayload.email);
    console.log('   Role:', accessPayload.role);
    console.log('   Expires:', new Date(accessPayload.exp! * 1000).toISOString(), '\n');
  } catch (error) {
    console.error('❌ Access token verification failed:', error);
  }

  // Verify refresh token
  try {
    const refreshPayload = verifyRefreshToken(tokens.refreshToken);
    console.log('✅ Refresh token verified:');
    console.log('   User ID:', refreshPayload.sub);
    console.log('   Expires:', new Date(refreshPayload.exp! * 1000).toISOString(), '\n');
  } catch (error) {
    console.error('❌ Refresh token verification failed:', error);
  }

  // Test invalid token
  try {
    verifyAccessToken('invalid.token.here');
    console.error('❌ Should have rejected invalid token');
  } catch (error) {
    console.log('✅ Invalid token correctly rejected:', (error as Error).message, '\n');
  }

  console.log('✅ All JWT tests passed!');
}

testJWT().catch(console.error);
