import { Router } from 'express';
import { ingredientController } from '../controllers/ingredient.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createIngredientSchema, updateIngredientSchema } from '../validators/ingredient.validator';

export const ingredientRoutes = Router();

ingredientRoutes.use(authenticate);

ingredientRoutes.get('/', ingredientController.list);
ingredientRoutes.get('/:id', ingredientController.getById);
ingredientRoutes.post('/', authorize('ADMIN'), validate(createIngredientSchema), ingredientController.create);
ingredientRoutes.patch('/:id', authorize('ADMIN'), validate(updateIngredientSchema), ingredientController.update);
