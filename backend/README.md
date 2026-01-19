# SokoShamba Backend API

Farm-to-consumer marketplace connecting Kenyan farmers directly with urban consumers.

## Project Status

**Current Session:** 4 Complete (User & Farmer Management)  
**Next Session:** 5 (Product & Category System)  
**Progress:** 4/19 sessions (21%)  
**API Endpoints:** 22 implemented  
**Tests Passing:** 37/37

## Tech Stack

- **Runtime:** Node.js 20.x + TypeScript
- **Framework:** Express.js 4.x
- **Database:** PostgreSQL 16 (via Docker)
- **ORM:** Prisma 6.x
- **Cache:** Redis 7 (via Docker)
- **Auth:** JWT + bcrypt
- **File Storage:** Cloudinary
- **File Upload:** Multer

## Prerequisites

- Docker & Docker Compose
- Node.js 20.x
- npm
- Cloudinary account (free tier)

## Quick Start

### 1. Start Docker Services
```bash
# From project root (sokoshamba/)
docker compose up -d

# Verify services are running
docker compose ps
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment
```bash
# Copy example
cp .env.example .env

# Edit .env and add:
# - DATABASE_URL (PostgreSQL connection)
# - REDIS_URL (Redis connection)
# - JWT_SECRET and JWT_REFRESH_SECRET (generate secure keys)
# - CLOUDINARY credentials (from cloudinary.com dashboard)
```

### 4. Setup Database
```bash
# Run migrations
npm run db:migrate

# Seed with test data
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Server runs at: `http://localhost:3001`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with test data
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:setup` - Migrate + Seed (fresh setup)
- `npm run db:reset` - Reset database and re-seed
- `npm run test:cloudinary` - Test Cloudinary integration
- `npm run test:user` - Test user endpoints
- `npm run test:address` - Test address endpoints
- `npm run test:farmer` - Test farmer endpoints

## Health Check Endpoints

- `GET /health` - API status
- `GET /health/db` - Database connection + stats
- `GET /health/redis` - Redis connection

## API Endpoints

### Authentication (7 endpoints)

```
POST   /api/auth/register          - Register new user
POST   /api/auth/login             - Login with email/password
POST   /api/auth/refresh           - Refresh access token
POST   /api/auth/logout            - Logout (invalidate token)
GET    /api/auth/me                - Get current user profile
POST   /api/auth/forgot-password   - Request password reset (stub)
POST   /api/auth/reset-password    - Reset password with token (stub)
```

### User Management (5 endpoints)

```
GET    /api/users/:id                   - Get user profile (public)
PATCH  /api/users/:id                   - Update profile (auth + ownership)
DELETE /api/users/:id                   - Delete account (auth + ownership)
POST   /api/users/:id/profile-image     - Upload profile image
DELETE /api/users/:id/profile-image     - Delete profile image
```

### Address Management (6 endpoints)

```
GET    /api/users/:userId/addresses     - List user addresses
POST   /api/users/:userId/addresses     - Create address
GET    /api/addresses/:id               - Get single address
PATCH  /api/addresses/:id               - Update address
DELETE /api/addresses/:id               - Delete address
PATCH  /api/addresses/:id/set-default   - Set as default
```

### Farmer Management (5 endpoints)

```
GET    /api/farmers                     - List farmers (filters: county, verified, search)
GET    /api/farmers/:id                 - Get farmer profile
PATCH  /api/farmers/:id                 - Update profile (auth + farmer role)
GET    /api/farmers/:id/products        - Get farmer's products
GET    /api/farmers/:id/reviews         - Get farmer's reviews
```

## Test Credentials

**Admin:**
- Email: `admin@sokoshamba.co.ke`
- Password: `Admin@2024`

**Farmer (example from seed):**
- Email: `john.kamau0@farmer.co.ke`
- Password: `Farmer@2024`

**Consumer (example from seed):**
- Email: `john.kamau0@gmail.com`
- Password: `Consumer@2024`

**Test Consumer (created in Session 3):**
- Email: `test.consumer@sokoshamba.co.ke`
- Password: `TestPass123!`

**Test Farmer (created in Session 4):**
- Email: `test.farmer.new@sokoshamba.co.ke`
- Password: `FarmerTest123!`

## Database Schema

10 tables:
- `users` - All users (consumers, farmers, admins) - 76 records
- `farmer_profiles` - Extended farmer information - 21 records
- `categories` - Product categories - 5 records
- `products` - Farmer products - 100 records
- `addresses` - Delivery addresses - 50+ records
- `orders` - Customer orders - 50 records
- `order_items` - Items in orders - 131 records
- `transactions` - Payment records - 50 records
- `reviews` - Product/farmer reviews - 11 records
- `notifications` - User notifications - 30 records

## Environment Variables

See `.env.example` for all required variables.

**Critical Variables:**
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/sokoshamba"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

## Project Structure
```
backend/
├── prisma/
│   ├── schema.prisma       # Database schema (10 models)
│   ├── seed.ts            # Seed data script (461 records)
│   └── migrations/        # Database migrations
├── src/
│   ├── config/            # Configuration (Cloudinary, etc.)
│   ├── controllers/       # Route controllers (auth, user, farmer, address)
│   ├── middleware/        # Express middleware (auth, upload, errors)
│   ├── routes/            # API routes
│   ├── utils/             # Helper functions (JWT, password, upload, validation)
│   └── server.ts          # Express app entry point
├── .env                   # Environment variables (not in git)
├── .env.example           # Environment template
├── package.json
└── tsconfig.json
```

## Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Test locally: `npm run dev`
4. Commit: `git commit -m "feat: your feature"`
5. Push and create PR

## Docker Commands
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v

# View logs
docker compose logs -f

# Access PostgreSQL
docker exec -it sokoshamba-postgres psql -U sokoshamba -d sokoshamba

# Access Redis CLI
docker exec -it sokoshamba-redis redis-cli
```

## Testing

### Manual API Testing

Use the provided test scripts:
```bash
npm run test:cloudinary  # Cloudinary integration (5 tests)
npm run test:user        # User endpoints (6 tests)
npm run test:address     # Address endpoints (9 tests)
npm run test:farmer      # Farmer endpoints (9 tests)
```

All 29 tests should pass.

### Example API Calls

**Register:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "phone": "254712345678",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User",
    "role": "consumer"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123!"}'
```

**Get Profile (with auth):**
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Next Steps (Session 5)

- [ ] Product CRUD operations
- [ ] Category management
- [ ] Product search and filtering
- [ ] Inventory management
- [ ] Multiple image upload for products

## Completed Sessions

- ✅ Session 1: Brand Identity & Architecture
- ✅ Session 2: Database Foundation
- ✅ Session 3: Authentication System
- ✅ Session 4: User & Farmer Management

## License

UNLICENSED - Proprietary

## Support

For questions or issues, contact the development team.