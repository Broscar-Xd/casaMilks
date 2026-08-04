import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createCategorySchema, updateCategorySchema, saveComboLinesSchema } from '../validators/category.validator';

export const categoryRoutes = Router();

categoryRoutes.use(authenticate);

categoryRoutes.get('/', categoryController.list);
categoryRoutes.get('/all', authorize('ADMIN'), categoryController.listAll);
categoryRoutes.get('/:id', categoryController.getById);
categoryRoutes.post('/', authorize('ADMIN'), validate(createCategorySchema), categoryController.create);
categoryRoutes.patch('/:id', authorize('ADMIN'), validate(updateCategorySchema), categoryController.update);

// Combo lines (lectura pública para personal del POS, solo admin puede editar)
categoryRoutes.get('/:id/combos', categoryController.getComboLines);
categoryRoutes.put('/:id/combos', authorize('ADMIN'), validate(saveComboLinesSchema), categoryController.saveComboLines);
