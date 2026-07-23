import { Router } from 'express';
import { recipeController } from '../controllers/recipe.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { bulkCreateRecipeSchema } from '../validators/recipe.validator';

export const recipeRoutes = Router();

recipeRoutes.use(authenticate);

recipeRoutes.get('/product/:productId', recipeController.findByProduct);
recipeRoutes.post('/bulk', authorize('ADMIN'), validate(bulkCreateRecipeSchema), recipeController.bulkCreate);
recipeRoutes.delete('/:productId/:ingredientId', authorize('ADMIN'), recipeController.delete);
