import { Response, NextFunction } from 'express';
import { recipeService } from '../services/recipe.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const recipeController = {
  findByProduct: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const recipes = await recipeService.findByProduct(p(req.params, 'productId'));
      res.json({ success: true, data: recipes });
    } catch (error) {
      next(error);
    }
  },

  bulkCreate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const recipes = await recipeService.bulkCreate(req.body);
      res.status(201).json({ success: true, data: recipes });
    } catch (error) {
      next(error);
    }
  },

  delete: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await recipeService.delete(p(req.params, 'productId'), p(req.params, 'ingredientId'));
      res.json({ success: true, message: 'Receta eliminada' });
    } catch (error) {
      next(error);
    }
  },
};
