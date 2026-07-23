import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createTableOrderSchema, addItemsToOrderSchema, closeOrderSchema } from '../validators/order.validator';

export const orderRoutes = Router();

orderRoutes.use(authenticate);

// Kitchen sends
orderRoutes.get('/kitchen', orderController.getKitchenSends);
orderRoutes.patch('/kitchen/:sendId/ready', orderController.markKitchenReady);

// Table orders
orderRoutes.get('/table/:tableId', orderController.getByTable);

// CRUD
orderRoutes.get('/', orderController.listByBranch);
orderRoutes.get('/:id', orderController.getById);
orderRoutes.post('/', validate(createTableOrderSchema), orderController.create);
orderRoutes.post('/:id/items', validate(addItemsToOrderSchema), orderController.addItems);
orderRoutes.post('/:id/close', validate(closeOrderSchema), orderController.close);
