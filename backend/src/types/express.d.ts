import { Request } from 'express';
import { AuthenticatedRequest as BaseAuthRequest, JwtPayload } from '../types';

/** Override de tipos de Express para manejar params como string puro. */
export interface TypedRequest<T = {}> extends Request<{ id: string; productId?: string; ingredientId?: string }> {
  body: T;
}

export interface AuthTypedRequest<T = {}> extends BaseAuthRequest {
  body: T;
}
