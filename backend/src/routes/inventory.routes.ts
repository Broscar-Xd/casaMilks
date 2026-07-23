import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { adjustInventorySchema } from '../validators/inventory.validator';

export const inventoryRoutes = Router();

inventoryRoutes.use(authenticate);

inventoryRoutes.get('/', inventoryController.getByBranch);
inventoryRoutes.get('/alerts', inventoryController.getAlerts);
inventoryRoutes.get('/movements', inventoryController.getMovements);
inventoryRoutes.post('/adjust', authorize('ADMIN'), validate(adjustInventorySchema), inventoryController.adjust);
