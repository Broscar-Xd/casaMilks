import { Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const productController = {
  listByBranch: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, categoryId } = req.query;
      const products = await productService.listByBranch(
        branchId as string,
        categoryId as string | undefined
      );
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  },

  listAll: async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const products = await productService.listAll();
      res.json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await productService.getById(p(req.params, 'id'));
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await productService.create(req.body);
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  },

  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await productService.update(p(req.params, 'id'), req.body);
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  },
};
