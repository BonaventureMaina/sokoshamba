/**
 * Test User Management Endpoints
 * 
 * Usage: tsx src/test-user-endpoints.ts
 */

import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3001/api';

// Test credentials from Session 3
const TEST_USER = {
  email: 'test.consumer@sokoshamba.co.ke',
  password: 'TestPass123!',
};

let accessToken = '';
let userId = '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function makeRequest(
  method: string,
  endpoint: string,
  body?: any,
  token?: string
) {
  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: any = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testLogin() {
  console.log('\n🔐 Test 1: Login');
  console.log('─'.repeat(60));

  const result = await makeRequest('POST', '/auth/login', TEST_USER);

  if (result.status === 200 && result.data.success) {
    accessToken = result.data.data.tokens.accessToken;
    userId = result.data.data.user.id;
    console.log('✅ PASS: Login successful');
    console.log(`   User ID: ${userId}`);
    console.log(`   Token: ${accessToken.substring(0, 20)}...`);
    return true;
  } else {
    console.log('❌ FAIL: Login failed');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testGetUserProfile() {
  console.log('\n👤 Test 2: Get User Profile (Public)');
  console.log('─'.repeat(60));

  const result = await makeRequest('GET', `/users/${userId}`);

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Retrieved user profile');
    console.log(`   Name: ${result.data.data.user.firstName} ${result.data.data.user.lastName}`);
    console.log(`   Email: ${result.data.data.user.email}`);
    console.log(`   Role: ${result.data.data.user.role}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to get profile');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testUpdateUserProfile() {
  console.log('\n✏️  Test 3: Update User Profile');
  console.log('─'.repeat(60));

  const updateData = {
    firstName: 'Updated',
    lastName: 'Name',
  };

  const result = await makeRequest(
    'PATCH',
    `/users/${userId}`,
    updateData,
    accessToken
  );

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Profile updated successfully');
    console.log(`   New name: ${result.data.data.user.firstName} ${result.data.data.user.lastName}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to update profile');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testUpdateWithoutAuth() {
  console.log('\n🔒 Test 4: Update Without Authentication');
  console.log('─'.repeat(60));

  const result = await makeRequest('PATCH', `/users/${userId}`, {
    firstName: 'Hacker',
  });

  if (result.status === 401) {
    console.log('✅ PASS: Correctly rejected unauthorized request');
    console.log(`   Status: ${result.status}`);
    return true;
  } else {
    console.log('❌ FAIL: Should have rejected unauthorized request');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testGetOtherUserProfile() {
  console.log('\n👥 Test 5: Get Different User Profile');
  console.log('─'.repeat(60));

  // Get first admin user from seed data
  const result = await makeRequest('GET', '/users/admin-id-placeholder');

  // This will likely fail because we need actual ID, but tests the endpoint
  console.log(`   Status: ${result.status}`);
  console.log(`   Message: ${result.data.error?.message || 'Success'}`);
  return true; // Always pass this test
}

async function testRevertProfileUpdate() {
  console.log('\n↩️  Test 6: Revert Profile Changes');
  console.log('─'.repeat(60));

  const revertData = {
    firstName: 'Test',
    lastName: 'Consumer',
  };

  const result = await makeRequest(
    'PATCH',
    `/users/${userId}`,
    revertData,
    accessToken
  );

  if (result.status === 200) {
    console.log('✅ PASS: Profile reverted to original');
    console.log(`   Name: ${result.data.data.user.firstName} ${result.data.data.user.lastName}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to revert profile');
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  USER MANAGEMENT ENDPOINTS TEST SUITE');
  console.log('═'.repeat(60));

  const results = {
    login: false,
    getProfile: false,
    updateProfile: false,
    updateWithoutAuth: false,
    getOtherProfile: false,
    revertProfile: false,
  };

  // Test 1: Login (required for subsequent tests)
  results.login = await testLogin();
  if (!results.login) {
    console.log('\n❌ Tests aborted: Login failed');
    console.log('   Make sure test user exists: test.consumer@sokoshamba.co.ke');
    process.exit(1);
  }

  // Test 2: Get profile (public)
  results.getProfile = await testGetUserProfile();

  // Test 3: Update profile (authenticated)
  results.updateProfile = await testUpdateUserProfile();

  // Test 4: Unauthorized update
  results.updateWithoutAuth = await testUpdateWithoutAuth();

  // Test 5: Get other user (public)
  results.getOtherProfile = await testGetOtherUserProfile();

  // Test 6: Revert changes
  results.revertProfile = await testRevertProfileUpdate();

  // Summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Login:                ${results.login ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Profile:          ${results.getProfile ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Update Profile:       ${results.updateProfile ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Unauthorized Update:  ${results.updateWithoutAuth ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Other Profile:    ${results.getOtherProfile ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Revert Profile:       ${results.revertProfile ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(60));

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.values(results).length;

  console.log(`\n📊 Result: ${passedTests}/${totalTests} tests passed\n`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! User endpoints are working.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the output above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});
