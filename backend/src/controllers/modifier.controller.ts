import { Response, NextFunction } from 'express';
import { modifierService } from '../services/modifier.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const modifierController = {
  findByProduct: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const groups = await modifierService.findByProduct(p(req.params, 'productId'));
      res.json({ success: true, data: groups });
    } catch (error) {
      next(error);
    }
  },

  bulkReplace: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const groups = await modifierService.bulkReplace(req.body);
      res.status(201).json({ success: true, data: groups });
    } catch (error) {
      next(error);
    }
  },
};
