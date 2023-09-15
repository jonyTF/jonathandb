

/**
 * BaseAppError is a base class for all application-specific errors. 
 * It includes a statusCode property for HTTP responses.
 */
export class BaseAppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * UnauthorizedError should be thrown when authentication is required and has failed or has not yet been provided.
 */
export class UnauthorizedError extends BaseAppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * NotFoundError should be thrown when a requested resource could not be found.
 * Typically, this error is used when a request operates on a specific resource that does not exist.
 */
export class NotFoundError extends BaseAppError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

/**
 * InputError should be thrown when the client sends invalid data in the request.
 */
export class InputError extends BaseAppError {
  constructor(message: string = 'Input Error') {
    super(message, 422);
  }
}

/**
 * FailedUploadToS3Error should be thrown when a file upload to S3 fails for any reason.
 */
export class FailedUploadToS3Error extends BaseAppError {
  constructor(message: string = 'Failed Upload to S3') {
    super(message, 422);
  }
}

/**
 * FailedUploadToDBError should be thrown when a database operation fails.
 */
export class FailedUploadToDBError extends BaseAppError {
  constructor(message: string = 'Failed Upload to DB') {
    super(message, 422);
  }
}

/**
 * UserExistsError should be thrown when a user already in database
 * Typically, this error is used when a request operates on a specific resource that already exist.
 */
export class UserExistsError extends BaseAppError {
  constructor(message: string = 'user already exist, update current user or create another one') {
    super(message, 409);
  }
}

/**
 * UserNotExistsError should be thrown when a requested user could not be found.
 * Typically, this error is used when a request operates on a usere that does not exist.
 */
export class UserNotExistsError extends BaseAppError {
  constructor(message: string = 'can\'t find user') {
    super(message, 400);
  }
}


/**
 * DeleteError should be thrown when deleting the only admin in user/admin system
 */
export class DeleteError extends BaseAppError {
  constructor(message: string = 'can\'t delete the only admin') {
    super(message, 403);
  }
}


