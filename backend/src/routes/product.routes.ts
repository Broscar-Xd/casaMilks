import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';

export const productRoutes = Router();

productRoutes.use(authenticate);

productRoutes.get('/', productController.listByBranch);
productRoutes.get('/all', authorize('ADMIN'), productController.listAll);
productRoutes.get('/:id', productController.getById);
productRoutes.post('/', authorize('ADMIN'), validate(createProductSchema), productController.create);
productRoutes.patch('/:id', authorize('ADMIN'), validate(updateProductSchema), productController.update);
