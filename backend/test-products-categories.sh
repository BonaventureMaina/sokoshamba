#!/bin/bash

# ============================================================================
# SokoShamba API - Product & Category Endpoints Test Script
# Tests all 12 new endpoints from Session 5
# ============================================================================

BASE_URL="http://localhost:3001"

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test credentials
ADMIN_EMAIL="admin@sokoshamba.co.ke"
ADMIN_PASSWORD="Admin@2024"
FARMER_EMAIL="john.kamau0@farmer.co.ke"
FARMER_PASSWORD="Farmer@2024"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SokoShamba - Product & Category Endpoints Test Suite    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

test_endpoint() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    local test_name="$1"
    local expected_code="$2"
    local actual_code="$3"
    local response="$4"
    
    if [ "$actual_code" -eq "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo -e "   Expected: $expected_code, Got: $actual_code"
        echo -e "   Response: $response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# ============================================================================
# AUTHENTICATION
# ============================================================================

echo -e "${YELLOW}[1/6] Authenticating users...${NC}"

# Login as admin
ADMIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_CODE=$(echo "$ADMIN_RESPONSE" | tail -n1)
ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | sed '$d' | jq -r '.data.tokens.accessToken')

if [ "$ADMIN_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} Admin logged in successfully"
else
    echo -e "${RED}✗${NC} Admin login failed"
    exit 1
fi

# Login as farmer
FARMER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$FARMER_EMAIL\",\"password\":\"$FARMER_PASSWORD\"}")
FARMER_CODE=$(echo "$FARMER_RESPONSE" | tail -n1)
FARMER_TOKEN=$(echo "$FARMER_RESPONSE" | sed '$d' | jq -r '.data.tokens.accessToken')

if [ "$FARMER_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} Farmer logged in successfully"
else
    echo -e "${RED}✗${NC} Farmer login failed"
    exit 1
fi

echo ""

# ============================================================================
# CATEGORY TESTS (5 endpoints)
# ============================================================================

echo -e "${YELLOW}[2/6] Testing Category Endpoints...${NC}"

# Test 1: GET /api/categories - List all categories
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/categories")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/categories (list all)" 200 "$CODE" "$BODY"

# Extract first category for testing
FIRST_CATEGORY_SLUG=$(echo "$BODY" | jq -r '.data.categories[0].slug')
FIRST_CATEGORY_ID=$(echo "$BODY" | jq -r '.data.categories[0].id')

# Test 2: GET /api/categories/:slug - Get by slug
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/categories/$FIRST_CATEGORY_SLUG")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/categories/:slug (get by slug)" 200 "$CODE" "$BODY"

# Test 3: GET /api/categories/:slug/products - Get products in category
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/categories/$FIRST_CATEGORY_SLUG/products")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/categories/:slug/products (list products)" 200 "$CODE" "$BODY"

# Test 4: POST /api/categories - Create category (admin only)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/categories" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Category - '"$(date +%s)"'",
        "slug": "test-category-'"$(date +%s)"'",
        "description": "Category created during testing"
    }')
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "POST /api/categories (create - admin)" 201 "$CODE" "$BODY"

NEW_CATEGORY_ID=$(echo "$BODY" | jq -r '.data.category.id')

# Test 5: PATCH /api/categories/:id - Update category (admin only)
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/categories/$NEW_CATEGORY_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"description": "Updated description"}')
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "PATCH /api/categories/:id (update - admin)" 200 "$CODE" "$BODY"

# Test 6: POST /api/categories - Unauthorized (farmer cannot create categories)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/categories" \
    -H "Authorization: Bearer $FARMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Unauthorized Category",
        "slug": "unauthorized-category"
    }')
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "POST /api/categories (unauthorized - farmer)" 403 "$CODE" "$BODY"

echo ""

# ============================================================================
# PRODUCT TESTS (7 endpoints)
# ============================================================================

echo -e "${YELLOW}[3/6] Testing Product Endpoints...${NC}"

# Test 7: GET /api/products - List all products
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products (list all)" 200 "$CODE" "$BODY"

# Test 8: GET /api/products with filters
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products?page=1&limit=5&sortBy=price_asc")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products?filters (pagination & sort)" 200 "$CODE" "$BODY"

# Test 9: POST /api/products - Create product (farmer only)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/products" \
    -H "Authorization: Bearer $FARMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "categoryId": "'"$FIRST_CATEGORY_ID"'",
        "name": "Test Product - '"$(date +%s)"'",
        "description": "Fresh organic test product",
        "unit": "kg",
        "unitQuantity": 1,
        "priceKsh": 150.00,
        "stockQuantity": 100,
        "isOrganic": true,
        "isAvailable": true,
        "tags": ["test", "organic"]
    }')
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "POST /api/products (create - farmer)" 201 "$CODE" "$BODY"

NEW_PRODUCT_ID=$(echo "$BODY" | jq -r '.data.product.id')

# Test 10: GET /api/products/:id - Get single product
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products/$NEW_PRODUCT_ID")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products/:id (get single)" 200 "$CODE" "$BODY"

# Test 11: PATCH /api/products/:id - Update product (farmer with ownership)
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/products/$NEW_PRODUCT_ID" \
    -H "Authorization: Bearer $FARMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "priceKsh": 175.00,
        "stockQuantity": 80,
        "description": "Updated description"
    }')
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "PATCH /api/products/:id (update - owner)" 200 "$CODE" "$BODY"

# Test 12: POST /api/products - Unauthorized (consumer cannot create)
CONSUMER_EMAIL="test.consumer@example.com"
CONSUMER_PASSWORD="Consumer@2024"

# Register consumer if not exists (ignore error if exists)
curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\":\"$CONSUMER_EMAIL\",
        \"phone\":\"254712345679\",
        \"password\":\"$CONSUMER_PASSWORD\",
        \"firstName\":\"Test\",
        \"lastName\":\"Consumer\",
        \"role\":\"consumer\"
    }" > /dev/null 2>&1

# Login as consumer
CONSUMER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$CONSUMER_EMAIL\",\"password\":\"$CONSUMER_PASSWORD\"}")
CONSUMER_TOKEN=$(echo "$CONSUMER_RESPONSE" | sed '$d' | jq -r '.data.tokens.accessToken')

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/products" \
    -H "Authorization: Bearer $CONSUMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "categoryId": "'"$FIRST_CATEGORY_ID"'",
        "name": "Unauthorized Product",
        "unit": "kg",
        "priceKsh": 100
    }')
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "POST /api/products (unauthorized - consumer)" 403 "$CODE" "$BODY"

echo ""

# ============================================================================
# ADVANCED FILTER TESTS
# ============================================================================

echo -e "${YELLOW}[4/6] Testing Advanced Product Filters...${NC}"

# Test 13: Filter by category
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products?categoryId=$FIRST_CATEGORY_ID")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products?categoryId (filter by category)" 200 "$CODE" "$BODY"

# Test 14: Filter by price range
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products?minPrice=50&maxPrice=200")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products?minPrice&maxPrice (price range)" 200 "$CODE" "$BODY"

# Test 15: Filter by organic
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products?isOrganic=true")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products?isOrganic (filter organic)" 200 "$CODE" "$BODY"

# Test 16: Search by name
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products?search=tomato")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products?search (search by name)" 200 "$CODE" "$BODY"

# Test 17: Sort by price descending
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products?sortBy=price_desc&limit=5")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products?sortBy=price_desc (sort)" 200 "$CODE" "$BODY"

echo ""

# ============================================================================
# IMAGE UPLOAD TESTS (using test image)
# ============================================================================

echo -e "${YELLOW}[5/6] Testing Product Image Endpoints...${NC}"

# Create a simple test image (1x1 pixel PNG)
TEST_IMAGE="test_product_image.png"
echo -n "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > "$TEST_IMAGE"

# Test 18: POST /api/products/:id/images - Upload image
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/products/$NEW_PRODUCT_ID/images" \
    -H "Authorization: Bearer $FARMER_TOKEN" \
    -F "productImages=@$TEST_IMAGE")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "POST /api/products/:id/images (upload images)" 200 "$CODE" "$BODY"

# Test 19: DELETE /api/products/:id/images/:imageIndex - Delete image
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/products/$NEW_PRODUCT_ID/images/0" \
    -H "Authorization: Bearer $FARMER_TOKEN")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "DELETE /api/products/:id/images/0 (delete image)" 200 "$CODE" "$BODY"

# Clean up test image
rm -f "$TEST_IMAGE"

echo ""

# ============================================================================
# CLEANUP & DELETE TESTS
# ============================================================================

echo -e "${YELLOW}[6/6] Testing Delete Endpoints...${NC}"

# Test 20: DELETE /api/products/:id - Delete product (owner)
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/products/$NEW_PRODUCT_ID" \
    -H "Authorization: Bearer $FARMER_TOKEN")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "DELETE /api/products/:id (delete - owner)" 200 "$CODE" "$BODY"

# Test 21: GET deleted product (should return 404)
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products/$NEW_PRODUCT_ID")
CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
test_endpoint "GET /api/products/:id (deleted product - 404)" 404 "$CODE" "$BODY"

echo ""

# ============================================================================
# TEST SUMMARY
# ============================================================================

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      TEST SUMMARY                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "Total Tests:  ${TOTAL_TESTS}"
echo -e "${GREEN}Passed:       ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed:       ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Product & Category system is working perfectly!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
