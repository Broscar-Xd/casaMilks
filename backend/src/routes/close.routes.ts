import { Router } from 'express';
import { closeController } from '../controllers/close.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { closeDaySchema } from '../validators/close.validator';

export const closeRoutes = Router();

closeRoutes.use(authenticate);
closeRoutes.use(authorize('ADMIN'));

closeRoutes.get('/', closeController.list);
closeRoutes.get('/by-date', closeController.getByDate);
closeRoutes.post('/', validate(closeDaySchema), closeController.execute);
