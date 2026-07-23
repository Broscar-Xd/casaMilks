import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { loginSchema, createUserSchema } from '../validators/auth.validator';

export const authRoutes = Router();

authRoutes.post('/login', validate(loginSchema), authController.login);
authRoutes.post('/register', authenticate, authorize('ADMIN'), validate(createUserSchema), authController.register);
authRoutes.get('/me', authenticate, authController.me);
