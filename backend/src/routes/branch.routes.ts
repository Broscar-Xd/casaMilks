import { Router } from 'express';
import { branchController } from '../controllers/branch.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createBranchSchema, updateBranchSchema, updateFiscalConfigSchema } from '../validators/branch.validator';

export const branchRoutes = Router();

branchRoutes.use(authenticate);

branchRoutes.get('/', branchController.list);
branchRoutes.get('/:id', branchController.getById);
branchRoutes.post('/', authorize('ADMIN'), validate(createBranchSchema), branchController.create);
branchRoutes.patch('/:id', authorize('ADMIN'), validate(updateBranchSchema), branchController.update);
branchRoutes.put('/:id/fiscal-config', authorize('ADMIN'), validate(updateFiscalConfigSchema), branchController.updateFiscalConfig);
