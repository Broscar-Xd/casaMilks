import { Router } from 'express';
import { modifierController } from '../controllers/modifier.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { bulkModifiersSchema } from '../validators/modifier.validator';

export const modifierRoutes = Router();

modifierRoutes.use(authenticate);

modifierRoutes.get('/product/:productId', modifierController.findByProduct);
modifierRoutes.post('/bulk', authorize('ADMIN'), validate(bulkModifiersSchema), modifierController.bulkReplace);
