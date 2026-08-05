import { Router } from 'express';
import { receiptController } from '../controllers/receipt.controller';
import { authenticate, authorize } from '../middlewares/auth';

export const receiptRoutes = Router();

// Solo ADMIN puede ver y reenviar facturas electrónicas
receiptRoutes.use(authenticate, authorize('ADMIN'));

receiptRoutes.get('/', receiptController.list);
receiptRoutes.get('/:id/status', receiptController.checkStatus);
receiptRoutes.get('/:id/xml', receiptController.getXml);
receiptRoutes.post('/:id/resend', receiptController.resend);
