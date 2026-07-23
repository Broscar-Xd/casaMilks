import { Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const categoryController = {
  list: async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await categoryService.list();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  },

  listAll: async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await categoryService.listAll();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const category = await categoryService.getById(p(req.params, 'id'));
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const category = await categoryService.create(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const category = await categoryService.update(p(req.params, 'id'), req.body);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },
};
