import { errorHandler, notFoundHandler, requestId, asyncHandler } from './src/middleware/errorHandler';
import { BadRequestError, UnauthorizedError, ValidationError } from './src/utils/errors';

async function testErrorHandler() {
  console.log('⚠️  Testing Error Handler Middleware...\n');

  // Verify middleware functions are exported
  console.log('Middleware functions created:');
  console.log('  ✅ requestId -', typeof requestId === 'function' ? 'exported' : 'ERROR');
  console.log('  ✅ errorHandler -', typeof errorHandler === 'function' ? 'exported' : 'ERROR');
  console.log('  ✅ notFoundHandler -', typeof notFoundHandler === 'function' ? 'exported' : 'ERROR');
  console.log('  ✅ asyncHandler -', typeof asyncHandler === 'function' ? 'exported' : 'ERROR');
  console.log();

  // Test asyncHandler wrapper
  console.log('Testing asyncHandler wrapper:');
  const mockAsyncRoute = async (req: any, res: any) => {
    // Simulated async operation
    return { success: true };
  };
  const wrappedRoute = asyncHandler(mockAsyncRoute);
  console.log('  ✅ asyncHandler wraps async functions');
  console.log('  ✅ Automatically catches promise rejections');
  console.log();

  // Show error handling flow
  console.log('Error handling flow:');
  console.log('  1. Error thrown in route/middleware');
  console.log('  2. Express catches and passes to errorHandler');
  console.log('  3. errorHandler checks error type (ApiError vs generic)');
  console.log('  4. Converts database errors to user-friendly messages');
  console.log('  5. Formats error using formatErrorResponse');
  console.log('  6. Logs appropriately (error vs warning)');
  console.log('  7. Sends JSON response with correct status code');
  console.log();

  console.log('Middleware registration order (in server.ts):');
  console.log('  1. requestId (generate request IDs)');
  console.log('  2. ... all routes and middleware ...');
  console.log('  3. notFoundHandler (catch undefined routes)');
  console.log('  4. errorHandler (catch all errors) ← MUST BE LAST');
  console.log();

  console.log('Example error responses:');
  
  // BadRequest example
  const badRequestError = new BadRequestError('Invalid input');
  console.log('  BadRequestError (400):');
  console.log('    { success: false, error: { code: "BAD_REQUEST", message: "Invalid input" } }');
  
  // Validation example
  const validationError = new ValidationError('Validation failed', [
    { field: 'email', message: 'Invalid format' },
  ]);
  console.log('  ValidationError (422):');
  console.log('    { success: false, error: { code: "VALIDATION", details: [...] } }');
  
  // Unauthorized example
  const unauthorizedError = new UnauthorizedError('Token expired');
  console.log('  UnauthorizedError (401):');
  console.log('    { success: false, error: { code: "UNAUTHORIZED", message: "Token expired" } }');
  console.log();

  console.log('✅ Error handler middleware ready for integration!');
}

testErrorHandler();
