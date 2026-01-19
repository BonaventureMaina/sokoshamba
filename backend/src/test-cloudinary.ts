/**
 * Test Cloudinary Integration
 * 
 * Usage: npm run test:cloudinary
 */

import dotenv from 'dotenv';
import cloudinary, { isCloudinaryConfigured } from './config/cloudinary';
import { uploadBase64Image } from './utils/upload';
import { CLOUDINARY_FOLDERS } from './config/cloudinary';

// Load environment variables
dotenv.config();

// ============================================================================
// SAMPLE BASE64 IMAGE (1x1 red pixel PNG)
// ============================================================================

const SAMPLE_IMAGE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testConfiguration() {
  console.log('\n📋 Testing Cloudinary Configuration...');
  console.log('─'.repeat(60));

  if (!isCloudinaryConfigured()) {
    console.log('❌ FAIL: Cloudinary credentials not found in .env');
    console.log('\nPlease add to .env:');
    console.log('  CLOUDINARY_CLOUD_NAME="your_cloud_name"');
    console.log('  CLOUDINARY_API_KEY="your_api_key"');
    console.log('  CLOUDINARY_API_SECRET="your_api_secret"');
    return false;
  }

  console.log('✅ PASS: Cloudinary credentials found');
  console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY?.substring(0, 8)}...`);
  return true;
}

async function testConnection() {
  console.log('\n🔌 Testing Cloudinary Connection...');
  console.log('─'.repeat(60));

  try {
    // Ping Cloudinary API
    const result = await cloudinary.api.ping();
    console.log('✅ PASS: Successfully connected to Cloudinary');
    console.log('   Status:', result.status);
    return true;
  } catch (error: any) {
    console.log('❌ FAIL: Connection failed');
    console.log('   Error:', error.message);
    return false;
  }
}

async function testUpload() {
  console.log('\n📤 Testing Image Upload...');
  console.log('─'.repeat(60));

  try {
    // Upload sample image
    const result = await uploadBase64Image(SAMPLE_IMAGE_BASE64, {
      folder: CLOUDINARY_FOLDERS.TEMP,
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
    });

    console.log('✅ PASS: Image uploaded successfully');
    console.log('   Public ID:', result.publicId);
    console.log('   URL:', result.secureUrl);
    console.log('   Size:', result.bytes, 'bytes');
    console.log('   Dimensions:', `${result.width}x${result.height}`);
    console.log('   Format:', result.format);

    return result.publicId; // Return for cleanup
  } catch (error: any) {
    console.log('❌ FAIL: Upload failed');
    console.log('   Error:', error.message);
    return null;
  }
}

async function testDelete(publicId: string) {
  console.log('\n🗑️  Testing Image Deletion...');
  console.log('─'.repeat(60));

  try {
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      console.log('✅ PASS: Image deleted successfully');
      return true;
    } else {
      console.log('⚠️  WARNING: Deletion returned unexpected result');
      console.log('   Result:', result.result);
      return false;
    }
  } catch (error: any) {
    console.log('❌ FAIL: Deletion failed');
    console.log('   Error:', error.message);
    return false;
  }
}

async function testResourceList() {
  console.log('\n📁 Testing Resource Listing...');
  console.log('─'.repeat(60));

  try {
    // List resources in temp folder
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: CLOUDINARY_FOLDERS.TEMP,
      max_results: 10,
    });

    console.log('✅ PASS: Listed resources successfully');
    console.log(`   Found ${result.resources.length} images in temp folder`);

    if (result.resources.length > 0) {
      console.log('   Sample image:', result.resources[0].public_id);
    }

    return true;
  } catch (error: any) {
    console.log('❌ FAIL: Listing failed');
    console.log('   Error:', error.message);
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  CLOUDINARY INTEGRATION TEST SUITE');
  console.log('═'.repeat(60));

  const results = {
    configuration: false,
    connection: false,
    upload: false,
    delete: false,
    list: false,
  };

  // Test 1: Configuration
  results.configuration = await testConfiguration();
  if (!results.configuration) {
    console.log('\n❌ Tests aborted: Configuration failed');
    process.exit(1);
  }

  // Test 2: Connection
  results.connection = await testConnection();
  if (!results.connection) {
    console.log('\n❌ Tests aborted: Connection failed');
    process.exit(1);
  }

  // Test 3: Upload
  const uploadedPublicId = await testUpload();
  results.upload = !!uploadedPublicId;

  // Test 4: Delete (cleanup)
  if (uploadedPublicId) {
    results.delete = await testDelete(uploadedPublicId);
  }

  // Test 5: Resource List
  results.list = await testResourceList();

  // Summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Configuration:  ${results.configuration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Connection:     ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Upload:         ${results.upload ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Delete:         ${results.delete ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`List Resources: ${results.list ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(60));

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.values(results).length;

  console.log(`\n📊 Result: ${passedTests}/${totalTests} tests passed\n`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Cloudinary is ready to use.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check configuration and credentials.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});
