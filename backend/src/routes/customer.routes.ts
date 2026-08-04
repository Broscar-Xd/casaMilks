import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { upsertCustomerSchema } from '../validators/customer.validator';

export const customerRoutes = Router();

customerRoutes.use(authenticate);

customerRoutes.get('/', customerController.list);
customerRoutes.post('/', validate(upsertCustomerSchema), customerController.upsert);
