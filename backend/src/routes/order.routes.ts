import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createTableOrderSchema, createTakeoutOrderSchema, addItemsToOrderSchema, closeOrderSchema } from '../validators/order.validator';
import { invoiceSchema } from '../validators/invoice.validator';

export const orderRoutes = Router();

orderRoutes.use(authenticate);

// Kitchen sends
orderRoutes.get('/kitchen', orderController.getKitchenSends);
orderRoutes.patch('/kitchen/:sendId/ready', orderController.markKitchenReady);

// Table orders
orderRoutes.get('/table/:tableId', orderController.getByTable);
orderRoutes.post('/takeout', validate(createTakeoutOrderSchema), orderController.createTakeout);

// CRUD
orderRoutes.get('/', orderController.listByBranch);
orderRoutes.get('/:id/pdf', orderController.getPdf);
orderRoutes.get('/:id', orderController.getById);
orderRoutes.post('/', validate(createTableOrderSchema), orderController.create);
orderRoutes.post('/:id/items', validate(addItemsToOrderSchema), orderController.addItems);
orderRoutes.post('/:id/close', validate(closeOrderSchema), orderController.close);
orderRoutes.patch('/:id/invoice', validate(invoiceSchema), orderController.updateInvoice);
orderRoutes.post('/:id/emit-invoice', orderController.emitInvoice);
