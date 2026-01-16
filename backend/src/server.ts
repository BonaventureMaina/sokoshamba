import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Middleware
import { requestId, errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize Redis Client
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });
  redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
  });
} catch (error) {
  console.error('❌ Failed to initialize Redis:', error);
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Request ID generation (must be early)
app.use(requestId);

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ============================================================================
// HEALTH CHECK ROUTES
// ============================================================================

// Basic health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'SokoShamba API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Database health check
app.get('/health/db', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    // Get some basic stats
    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();
    const orderCount = await prisma.order.count();

    res.status(200).json({
      success: true,
      message: 'Database connection healthy',
      stats: {
        users: userCount,
        products: productCount,
        orders: orderCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Redis health check
app.get('/health/redis', async (req: Request, res: Response) => {
  try {
    if (!redis) {
      throw new Error('Redis client not initialized');
    }

    await redis.ping();

    res.status(200).json({
      success: true,
      message: 'Redis connection healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Redis health check failed:', error);
    res.status(503).json({
      success: false,
      message: 'Redis connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// API ROUTES
// ============================================================================

// Mount authentication routes
app.use('/api/auth', authRoutes);

// ============================================================================
// ERROR HANDLING (must be after all routes)
// ============================================================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const server = app.listen(PORT, () => {
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│ 🚀 SokoShamba API Server Started                   │');
  console.log('└─────────────────────────────────────────────────────┘');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🗄️  Database check: http://localhost:${PORT}/health/db`);
  console.log(`💾 Redis check: http://localhost:${PORT}/health/redis`);
  console.log('\n📋 Authentication Endpoints:');
  console.log(`   POST   /api/auth/register`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   POST   /api/auth/logout`);
  console.log(`   POST   /api/auth/refresh`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   POST   /api/auth/forgot-password`);
  console.log(`   POST   /api/auth/reset-password`);
  console.log('└─────────────────────────────────────────────────────┘\n');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');

  server.close(async () => {
    console.log('✅ HTTP server closed');

    // Disconnect Prisma
    await prisma.$disconnect();
    console.log('✅ Database disconnected');

    // Disconnect Redis
    if (redis) {
      await redis.quit();
      console.log('✅ Redis disconnected');
    }

    console.log('👋 Shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');

  server.close(async () => {
    await prisma.$disconnect();
    if (redis) {
      await redis.quit();
    }
    console.log('👋 Shutdown complete');
    process.exit(0);
  });
});

export default app;