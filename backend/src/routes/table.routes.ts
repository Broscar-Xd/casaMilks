import { Router } from 'express';
import { tableController } from '../controllers/table.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createTableSchema, updateTableSchema } from '../validators/table.validator';

export const tableRoutes = Router();

tableRoutes.use(authenticate);

tableRoutes.get('/', tableController.listByBranch);
tableRoutes.get('/:id', tableController.getById);
tableRoutes.post('/', authorize('ADMIN'), validate(createTableSchema), tableController.create);
tableRoutes.patch('/:id', authorize('ADMIN'), validate(updateTableSchema), tableController.update);
tableRoutes.delete('/:id', authorize('ADMIN'), tableController.delete);
