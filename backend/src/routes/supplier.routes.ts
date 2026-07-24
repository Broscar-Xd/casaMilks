import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createSupplierPaymentSchema } from '../validators/supplier.validator';

export const supplierRoutes = Router();

supplierRoutes.use(authenticate);
supplierRoutes.use(authorize('ADMIN'));

supplierRoutes.get('/', supplierController.list);
supplierRoutes.get('/list', supplierController.listSuppliers);
supplierRoutes.post('/', validate(createSupplierPaymentSchema), supplierController.create);
