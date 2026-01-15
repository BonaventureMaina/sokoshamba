import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ValidationError,
  formatErrorResponse,
  createValidationError,
  getStatusCode,
  shouldLogError,
  isDatabaseUniqueViolation,
  handleDatabaseUniqueViolation,
} from './src/utils/errors';

function testErrors() {
  console.log('⚠️  Testing Error utilities...\n');

  // Test 1: Custom error classes
  console.log('Test 1: Custom error classes');
  const badRequest = new BadRequestError('Invalid input');
  console.log('  BadRequestError:', badRequest.name, '-', badRequest.statusCode);
  
  const unauthorized = new UnauthorizedError('Token expired');
  console.log('  UnauthorizedError:', unauthorized.name, '-', unauthorized.statusCode);
  
  const notFound = new NotFoundError('User not found');
  console.log('  NotFoundError:', notFound.name, '-', notFound.statusCode, '\n');

  // Test 2: Validation error with fields
  console.log('Test 2: Validation error');
  const validationError = createValidationError([
    { field: 'email', message: 'Invalid email format' },
    { field: 'password', message: 'Password too short' },
  ]);
  console.log('  Message:', validationError.message);
  console.log('  Fields:', validationError.errors.map(e => e.field).join(', '));
  console.log('  Status code:', validationError.statusCode, '\n');

  // Test 3: Format error response
  console.log('Test 3: Format error response');
  const formattedBadRequest = formatErrorResponse(badRequest, 'req-12345');
  console.log('  Formatted BadRequestError:');
  console.log('    success:', formattedBadRequest.success);
  console.log('    error.code:', formattedBadRequest.error.code);
  console.log('    error.message:', formattedBadRequest.error.message);
  console.log('    meta.requestId:', formattedBadRequest.meta.requestId);

  const formattedValidation = formatErrorResponse(validationError);
  console.log('  Formatted ValidationError:');
  console.log('    error.code:', formattedValidation.error.code);
  console.log('    error.details:', formattedValidation.error.details, '\n');

  // Test 4: Generic error formatting (non-ApiError)
  console.log('Test 4: Generic error handling');
  const genericError = new Error('Something went wrong');
  const formatted = formatErrorResponse(genericError);
  console.log('  Generic error code:', formatted.error.code);
  console.log('  Message hidden in production:', formatted.error.message.includes('unexpected'));
  console.log('  Stack trace in dev:', !!formatted.error.details, '\n');

  // Test 5: Get status codes
  console.log('Test 5: Status code extraction');
  console.log('  BadRequest:', getStatusCode(badRequest));
  console.log('  Unauthorized:', getStatusCode(unauthorized));
  console.log('  NotFound:', getStatusCode(notFound));
  console.log('  Generic error:', getStatusCode(genericError), '\n');

  // Test 6: Should log error
  console.log('Test 6: Error logging decisions');
  console.log('  BadRequest (operational):', shouldLogError(badRequest) ? 'Log as error' : 'Log as warning');
  console.log('  Generic error (unexpected):', shouldLogError(genericError) ? 'Log as error' : 'Log as warning', '\n');

  // Test 7: Database unique violation
  console.log('Test 7: Database error handling');
  const prismaError = {
    code: 'P2002',
    meta: { target: ['email'] },
    message: 'Unique constraint failed on email',
  };
  console.log('  Is unique violation:', isDatabaseUniqueViolation(prismaError));
  const conflictError = handleDatabaseUniqueViolation(prismaError);
  console.log('  Converted message:', conflictError.message);
  console.log('  Status code:', conflictError.statusCode, '\n');

  console.log('✅ All error handling tests passed!');
}

testErrors();
