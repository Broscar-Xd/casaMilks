import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createUserSchema, updateUserSchema } from '../validators/auth.validator';

export const userRoutes = Router();

userRoutes.use(authenticate);
userRoutes.use(authorize('ADMIN'));

userRoutes.get('/', userController.list);
userRoutes.get('/:id', userController.getById);
userRoutes.post('/', validate(createUserSchema), userController.create);
userRoutes.patch('/:id', validate(updateUserSchema), userController.update);
