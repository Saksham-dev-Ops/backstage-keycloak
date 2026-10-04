import { LoggerService } from '@backstage/backend-plugin-api';
import { CustomErrorBase } from '@backstage/errors';
import { ErrorRequestHandler } from 'express';

/** An error with a stable, machine-readable code, e.g. `DEPARTMENT_NOT_FOUND`. */
export class DepartmentApiError extends CustomErrorBase {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'DepartmentApiError';
  }
}

export const notFound = (code: string, message: string) =>
  new DepartmentApiError(404, code, message);
export const forbidden = (message: string) =>
  new DepartmentApiError(403, 'FORBIDDEN', message);
export const conflict = (code: string, message: string) =>
  new DepartmentApiError(409, code, message);
export const badRequest = (code: string, message: string) =>
  new DepartmentApiError(400, code, message);

/** Status and code of the standard Backstage errors */
const KNOWN_ERRORS: Record<string, { status: number; code: string }> = {
  InputError: { status: 400, code: 'BAD_REQUEST' },
  AuthenticationError: { status: 401, code: 'UNAUTHORIZED' },
  NotAllowedError: { status: 403, code: 'FORBIDDEN' },
  NotFoundError: { status: 404, code: 'NOT_FOUND' },
  ConflictError: { status: 409, code: 'CONFLICT' },
  ServiceUnavailableError: { status: 503, code: 'SERVICE_UNAVAILABLE' },
};

/**
 * Renders every error as `{ error: { code, message } }`. Messages of
 * unexpected errors are logged but never sent to the client.
 */
export function errorHandler(logger: LoggerService): ErrorRequestHandler {
  return (error: Error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof DepartmentApiError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }
    const known = KNOWN_ERRORS[error.name];
    if (known) {
      res
        .status(known.status)
        .json({ error: { code: known.code, message: error.message } });
      return;
    }
    logger.error('Unexpected error in department API', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  };
}
