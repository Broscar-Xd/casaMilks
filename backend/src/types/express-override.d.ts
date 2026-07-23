import 'express';

/**
 * Express 5 types define params as string | string[].
 * This override restores the standard single-string params
 * used throughout this application.
 */
declare module 'express' {
  interface Request {
    params: Record<string, string>;
  }
}
