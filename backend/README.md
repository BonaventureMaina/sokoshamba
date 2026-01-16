# SokoShamba Backend API

Farm-to-consumer marketplace connecting Kenyan farmers directly with urban consumers.

## Tech Stack

- **Runtime:** Node.js 20.x + TypeScript
- **Framework:** Express.js 4.x
- **Database:** PostgreSQL 16 (via Docker)
- **ORM:** Prisma 6.x
- **Cache:** Redis 7 (via Docker)
- **Auth:** JWT + bcrypt

## Prerequisites

- Docker & Docker Compose
- Node.js 20.x
- npm

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

### 3. Setup Database
```bash
# Run migrations
npm run db:migrate

# Seed with test data
npm run db:seed
```

### 4. Start Development Server
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

## Health Check Endpoints

- `GET /health` - API status
- `GET /health/db` - Database connection + stats
- `GET /health/redis` - Redis connection

## Test Credentials

**Admin:**
- Email: `admin@sokoshamba.co.ke`
- Password: `Admin@2024`

**Farmer (any of 20):**
- Email: `[firstname].[lastname][0-19]@farmer.co.ke`
- Password: `Farmer@2024`
- Example: `john.kamau0@farmer.co.ke`

**Consumer (any of 50):**
- Email: `[firstname].[lastname][0-49]@gmail.com`
- Password: `Consumer@2024`

## Database Schema

10 tables:
- `users` - All users (consumers, farmers, admins)
- `farmer_profiles` - Extended farmer information
- `categories` - Product categories
- `products` - Farmer products
- `addresses` - Delivery addresses
- `orders` - Customer orders
- `order_items` - Items in orders
- `transactions` - Payment records
- `reviews` - Product/farmer reviews
- `notifications` - User notifications

## Environment Variables

See `.env.example` for all required variables.

## Project Structure
```
backend/
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.ts            # Seed data script
│   └── migrations/        # Database migrations
├── src/
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Helper functions
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

## Next Steps (Session 3)

- [ ] JWT authentication system
- [ ] User registration/login endpoints
- [ ] Password reset flow
- [ ] Protected routes middleware

## License

UNLICENSED - Proprietary

## Authentication Endpoints (Session 3)

### Public Routes
- `POST /api/auth/register` - Register new user (consumer/farmer)
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset (stub)
- `POST /api/auth/reset-password` - Reset password with token (stub)

### Protected Routes (require JWT)
- `POST /api/auth/logout` - Logout (client-side token deletion)
- `GET /api/auth/me` - Get current user profile

### Test New User
```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "254712345678",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User",
    "role": "consumer"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123!"}'

# Get profile (use token from login)
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Project Status

**Completed:**
- ✅ Session 1: Brand Identity & Architecture
- ✅ Session 2: Database Foundation (10 tables, 461 records)
- ✅ Session 3: Authentication System (JWT, bcrypt, validation)

**Next:**
- ⏳ Session 4: User & Farmer Management
- ⏳ Session 5: Product & Category System
- ⏳ Session 6-19: See Project-Chat-Session-Breakdown.pdf
