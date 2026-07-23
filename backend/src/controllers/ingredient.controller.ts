import { Response, NextFunction } from 'express';
import { ingredientService } from '../services/ingredient.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const ingredientController = {
  list: async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ingredients = await ingredientService.list();
      res.json({ success: true, data: ingredients });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ingredient = await ingredientService.getById(p(req.params, 'id'));
      res.json({ success: true, data: ingredient });
    } catch (error) {
      next(error);
    }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ingredient = await ingredientService.create(req.body);
      res.status(201).json({ success: true, data: ingredient });
    } catch (error) {
      next(error);
    }
  },

  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ingredient = await ingredientService.update(p(req.params, 'id'), req.body);
      res.json({ success: true, data: ingredient });
    } catch (error) {
      next(error);
    }
  },
};
