/**
 * Test Address Management Endpoints
 * 
 * Usage: tsx src/test-address-endpoints.ts
 */

import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3001/api';

// Test credentials
const TEST_USER = {
  email: 'test.consumer@sokoshamba.co.ke',
  password: 'TestPass123!',
};

let accessToken = '';
let userId = '';
let addressId = '';

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
    return true;
  } else {
    console.log('❌ FAIL: Login failed');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testCreateAddress() {
  console.log('\n📍 Test 2: Create Address');
  console.log('─'.repeat(60));

  const addressData = {
    label: 'Home',
    fullName: 'Test Consumer',
    phone: '254712345678',
    county: 'Nairobi',
    subcounty: 'Westlands',
    streetAddress: '123 Muthithi Road',
    buildingDetails: 'Apartment 4B',
    deliveryInstructions: 'Call on arrival',
    isDefault: true,
  };

  const result = await makeRequest(
    'POST',
    `/users/${userId}/addresses`,
    addressData,
    accessToken
  );

  if (result.status === 201 && result.data.success) {
    addressId = result.data.data.address.id;
    console.log('✅ PASS: Address created successfully');
    console.log(`   Address ID: ${addressId}`);
    console.log(`   Label: ${result.data.data.address.label}`);
    console.log(`   County: ${result.data.data.address.county}`);
    console.log(`   Is Default: ${result.data.data.address.isDefault}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to create address');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testGetUserAddresses() {
  console.log('\n📋 Test 3: Get User Addresses');
  console.log('─'.repeat(60));

  const result = await makeRequest(
    'GET',
    `/users/${userId}/addresses`,
    null,
    accessToken
  );

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Retrieved addresses successfully');
    console.log(`   Count: ${result.data.meta.count}`);
    if (result.data.data.addresses.length > 0) {
      console.log(`   First address: ${result.data.data.addresses[0].label}`);
    }
    return true;
  } else {
    console.log('❌ FAIL: Failed to get addresses');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testGetSingleAddress() {
  console.log('\n🔍 Test 4: Get Single Address');
  console.log('─'.repeat(60));

  const result = await makeRequest(
    'GET',
    `/addresses/${addressId}`,
    null,
    accessToken
  );

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Retrieved address successfully');
    console.log(`   Label: ${result.data.data.address.label}`);
    console.log(`   Street: ${result.data.data.address.streetAddress}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to get address');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testUpdateAddress() {
  console.log('\n✏️  Test 5: Update Address');
  console.log('─'.repeat(60));

  const updateData = {
    label: 'Office',
    buildingDetails: 'Office Suite 10',
  };

  const result = await makeRequest(
    'PATCH',
    `/addresses/${addressId}`,
    updateData,
    accessToken
  );

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Address updated successfully');
    console.log(`   New label: ${result.data.data.address.label}`);
    console.log(`   New building: ${result.data.data.address.buildingDetails}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to update address');
    console.log('   Response:', result.data);
    return false;
  }
}

async function testCreateSecondAddress() {
  console.log('\n📍 Test 6: Create Second Address (Non-Default)');
  console.log('─'.repeat(60));

  const addressData = {
    label: 'Work',
    fullName: 'Test Consumer',
    phone: '254712345678',
    county: 'Kiambu',
    subcounty: 'Kikuyu',
    streetAddress: '456 Banana Road',
    isDefault: false,
  };

  const result = await makeRequest(
    'POST',
    `/users/${userId}/addresses`,
    addressData,
    accessToken
  );

  if (result.status === 201 && result.data.success) {
    console.log('✅ PASS: Second address created');
    console.log(`   Label: ${result.data.data.address.label}`);
    console.log(`   Is Default: ${result.data.data.address.isDefault}`);
    return result.data.data.address.id; // Return ID for later use
  } else {
    console.log('❌ FAIL: Failed to create second address');
    return null;
  }
}

async function testSetDefaultAddress(newAddressId: string) {
  console.log('\n⭐ Test 7: Set New Default Address');
  console.log('─'.repeat(60));

  const result = await makeRequest(
    'PATCH',
    `/addresses/${newAddressId}/set-default`,
    null,
    accessToken
  );

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Default address changed');
    console.log(`   New default: ${result.data.data.address.label}`);
    return true;
  } else {
    console.log('❌ FAIL: Failed to set default');
    return false;
  }
}

async function testDeleteAddress(deleteAddressId: string) {
  console.log('\n🗑️  Test 8: Delete Address');
  console.log('─'.repeat(60));

  const result = await makeRequest(
    'DELETE',
    `/addresses/${deleteAddressId}`,
    null,
    accessToken
  );

  if (result.status === 200 && result.data.success) {
    console.log('✅ PASS: Address deleted successfully');
    return true;
  } else {
    console.log('❌ FAIL: Failed to delete address');
    return false;
  }
}

async function testUnauthorizedAccess() {
  console.log('\n🔒 Test 9: Unauthorized Access');
  console.log('─'.repeat(60));

  const result = await makeRequest('GET', `/users/${userId}/addresses`);

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
  console.log('  ADDRESS MANAGEMENT ENDPOINTS TEST SUITE');
  console.log('═'.repeat(60));

  const results = {
    login: false,
    createAddress: false,
    getUserAddresses: false,
    getSingleAddress: false,
    updateAddress: false,
    createSecondAddress: false,
    setDefaultAddress: false,
    deleteAddress: false,
    unauthorizedAccess: false,
  };

  // Test 1: Login
  results.login = await testLogin();
  if (!results.login) {
    console.log('\n❌ Tests aborted: Login failed');
    process.exit(1);
  }

  // Test 2: Create address
  results.createAddress = await testCreateAddress();

  // Test 3: Get user addresses
  results.getUserAddresses = await testGetUserAddresses();

  // Test 4: Get single address
  results.getSingleAddress = await testGetSingleAddress();

  // Test 5: Update address
  results.updateAddress = await testUpdateAddress();

  // Test 6: Create second address
  const secondAddressId = await testCreateSecondAddress();
  results.createSecondAddress = !!secondAddressId;

  // Test 7: Set default address
  if (secondAddressId) {
    results.setDefaultAddress = await testSetDefaultAddress(secondAddressId);
  }

  // Test 8: Delete address
  if (secondAddressId) {
    results.deleteAddress = await testDeleteAddress(secondAddressId);
  }

  // Test 9: Unauthorized access
  results.unauthorizedAccess = await testUnauthorizedAccess();

  // Summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Login:                ${results.login ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Create Address:       ${results.createAddress ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get User Addresses:   ${results.getUserAddresses ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Single Address:   ${results.getSingleAddress ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Update Address:       ${results.updateAddress ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Create 2nd Address:   ${results.createSecondAddress ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Set Default:          ${results.setDefaultAddress ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Delete Address:       ${results.deleteAddress ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Unauthorized Access:  ${results.unauthorizedAccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(60));

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.values(results).length;

  console.log(`\n📊 Result: ${passedTests}/${totalTests} tests passed\n`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Address endpoints are working.\n');
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
