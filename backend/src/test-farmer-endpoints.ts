/**
 * Test Farmer Management Endpoints
 * 
 * Usage: tsx src/test-farmer-endpoints.ts
 */

import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3001/api';

// We'll create a new farmer for testing
const NEW_FARMER = {
  email: 'test.farmer.new@sokoshamba.co.ke',
  phone: '254722334455',
  password: 'FarmerTest123!',
  firstName: 'New',
  lastName: 'Farmer',
  role: 'farmer',
};

let accessToken = '';
let userId = '';
let farmerProfileId = '';

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

async function testRegisterFarmer() {
  console.log('\n🌾 Test 1: Register New Farmer');
  console.log('─'.repeat(60));

  const result = await makeRequest('POST', '/auth/register', NEW_FARMER);

  if (result.status === 201 && result.data.success) {
    accessToken = result.data.data.tokens.accessToken;
    userId = result.data.data.user.id;
    console.log('✅ PASS: Farmer registered successfully');
    console.log(`   User ID: ${userId}`);
    console.log(`   Role: ${result.data.data.user.role}`);
    return true;
  } else {
    console.log('❌ FAIL: Farmer registration failed');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testGetCurrentUser() {
  console.log('\n👤 Test 2: Get Current User (with Farmer Profile)');
  console.log('─'.repeat(60));

  const result = await makeRequest('GET', '/auth/me', null, accessToken);

  if (result.status === 200 && result.data.success) {
    const user = result.data.data.user;
    if (user.farmerProfile) {
      farmerProfileId = user.farmerProfile.id;
      console.log('✅ PASS: Retrieved user with farmer profile');
      console.log(`   Farmer Profile ID: ${farmerProfileId}`);
      console.log(`   Is Verified: ${user.farmerProfile.isVerified}`);
      return true;
    } else {
      console.log('❌ FAIL: No farmer profile found');
      return false;
    }
  } else {
    console.log('❌ FAIL: Failed to get current user');
    return false;
  }
}

async function testUpdateFarmerProfile() {
  console.log('\n✏️  Test 3: Update Farmer Profile');
  console.log('─'.repeat(60));

  const updateData = {
    farmName: 'Green Valley Farm',
    bio: 'Organic vegetables and fruits from the heart of Kenya',
    locationCounty: 'Kiambu',
    locationSubcounty: 'Kikuyu',
    locationDetails: 'Near Kikuyu Town',
  };

  const result = await makeRequest(
    'PATCH',
    `/farmers/${farmerProfileId}`,
    updateData,
    accessToken
  );

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Farmer profile updated successfully');
    console.log(`   Farm Name: ${result.data.data.farmer.farmName}`);
    console.log(`   Location: ${result.data.data.farmer.locationCounty}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to update farmer profile');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testGetFarmerProfile() {
  console.log('\n🔍 Test 4: Get Farmer Profile (Public)');
  console.log('─'.repeat(60));

  const result = await makeRequest('GET', `/farmers/${farmerProfileId}`);

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Retrieved farmer profile successfully');
    console.log(`   Farm Name: ${result.data.data.farmer.farmName}`);
    console.log(`   Bio: ${result.data.data.farmer.bio?.substring(0, 50)}...`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to get farmer profile');
    return false;
  }
}

async function testListFarmers() {
  console.log('\n📋 Test 5: List All Farmers');
  console.log('─'.repeat(60));

  const result = await makeRequest('GET', '/farmers?page=1&limit=5');

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Listed farmers successfully');
    console.log(`   Total farmers: ${result.data.meta.total}`);
    console.log(`   Returned: ${result.data.data.farmers.length}`);
    if (result.data.data.farmers.length > 0) {
      console.log(`   First farmer: ${result.data.data.farmers[0].farmName || 'No farm name'}`);
    }
    return true;
  } else {
    console.log('❌ FAIL: Failed to list farmers');
    return false;
  }
}

async function testFilterFarmersByCounty() {
  console.log('\n🔎 Test 6: Filter Farmers by County');
  console.log('─'.repeat(60));

  const result = await makeRequest('GET', '/farmers?county=Kiambu');

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Filtered farmers by county');
    console.log(`   Farmers in Kiambu: ${result.data.meta.total}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to filter farmers');
    return false;
  }
}

async function testGetFarmerProducts() {
  console.log('\n🥕 Test 7: Get Farmer Products');
  console.log('─'.repeat(60));

  // Use first farmer from seed data who has products
  const farmersResult = await makeRequest('GET', '/farmers?limit=1');
  
  if (farmersResult.data.data.farmers.length === 0) {
    console.log('⚠️  SKIP: No farmers in database');
    return true;
  }

  const firstFarmerId = farmersResult.data.data.farmers[0].id;
  const result = await makeRequest('GET', `/farmers/${firstFarmerId}/products`);

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Retrieved farmer products');
    console.log(`   Products count: ${result.data.meta.count}`);
    if (result.data.data.products.length > 0) {
      console.log(`   First product: ${result.data.data.products[0].name}`);
    }
    return true;
  } else {
    console.log('❌ FAIL: Failed to get farmer products');
    return false;
  }
}

async function testGetFarmerReviews() {
  console.log('\n⭐ Test 8: Get Farmer Reviews');
  console.log('─'.repeat(60));

  // Use first farmer from seed data
  const farmersResult = await makeRequest('GET', '/farmers?limit=1');
  
  if (farmersResult.data.data.farmers.length === 0) {
    console.log('⚠️  SKIP: No farmers in database');
    return true;
  }

  const firstFarmerId = farmersResult.data.data.farmers[0].id;
  const result = await makeRequest('GET', `/farmers/${firstFarmerId}/reviews`);

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Retrieved farmer reviews');
    console.log(`   Reviews count: ${result.data.meta.total}`);
    if (result.data.data.reviews.length > 0) {
      console.log(`   First review rating: ${result.data.data.reviews[0].rating}/5`);
    }
    return true;
  } else {
    console.log('❌ FAIL: Failed to get farmer reviews');
    return false;
  }
}

async function testUnauthorizedUpdate() {
  console.log('\n🔒 Test 9: Unauthorized Profile Update');
  console.log('─'.repeat(60));

  const result = await makeRequest(
    'PATCH',
    `/farmers/${farmerProfileId}`,
    { farmName: 'Hacker Farm' }
  );

  if (result.status === 401) {
    console.log('✅ PASS: Correctly rejected unauthorized request');
    return true;
  } else {
    console.log('❌ FAIL: Should have rejected unauthorized request');
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  FARMER MANAGEMENT ENDPOINTS TEST SUITE');
  console.log('═'.repeat(60));

  const results = {
    registerFarmer: false,
    getCurrentUser: false,
    updateProfile: false,
    getProfile: false,
    listFarmers: false,
    filterByCounty: false,
    getProducts: false,
    getReviews: false,
    unauthorizedUpdate: false,
  };

  // Test 1: Register farmer
  results.registerFarmer = await testRegisterFarmer();
  if (!results.registerFarmer) {
    console.log('\n❌ Tests aborted: Farmer registration failed');
    console.log('   Note: Farmer may already exist from previous test run');
    process.exit(1);
  }

  // Test 2: Get current user
  results.getCurrentUser = await testGetCurrentUser();
  if (!results.getCurrentUser) {
    console.log('\n❌ Tests aborted: No farmer profile found');
    process.exit(1);
  }

  // Test 3: Update farmer profile
  results.updateProfile = await testUpdateFarmerProfile();

  // Test 4: Get farmer profile (public)
  results.getProfile = await testGetFarmerProfile();

  // Test 5: List farmers
  results.listFarmers = await testListFarmers();

  // Test 6: Filter farmers by county
  results.filterByCounty = await testFilterFarmersByCounty();

  // Test 7: Get farmer products
  results.getProducts = await testGetFarmerProducts();

  // Test 8: Get farmer reviews
  results.getReviews = await testGetFarmerReviews();

  // Test 9: Unauthorized update
  results.unauthorizedUpdate = await testUnauthorizedUpdate();

  // Summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Register Farmer:      ${results.registerFarmer ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Current User:     ${results.getCurrentUser ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Update Profile:       ${results.updateProfile ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Profile:          ${results.getProfile ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`List Farmers:         ${results.listFarmers ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Filter by County:     ${results.filterByCounty ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Products:         ${results.getProducts ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Reviews:          ${results.getReviews ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Unauthorized Update:  ${results.unauthorizedUpdate ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(60));

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.values(results).length;

  console.log(`\n📊 Result: ${passedTests}/${totalTests} tests passed\n`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Farmer endpoints are working.\n');
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
