import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate, authorize } from '../middlewares/auth';

export const reportRoutes = Router();

reportRoutes.use(authenticate);
reportRoutes.use(authorize('ADMIN'));

reportRoutes.get('/sales-by-product', reportController.salesByProduct);
reportRoutes.get('/sales-by-time-slot', reportController.salesByTimeSlot);
reportRoutes.get('/payments-by-method', reportController.paymentsByMethod);
reportRoutes.get('/export-excel', reportController.exportToExcel);
