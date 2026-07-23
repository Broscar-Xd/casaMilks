import { Response, NextFunction } from 'express';
import { branchService } from '../services/branch.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const branchController = {
  list: async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const branches = await branchService.list();
      res.json({ success: true, data: branches });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const branch = await branchService.getById(p(req.params, 'id'));
      res.json({ success: true, data: branch });
    } catch (error) {
      next(error);
    }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const branch = await branchService.create(req.body);
      res.status(201).json({ success: true, data: branch });
    } catch (error) {
      next(error);
    }
  },

  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const branch = await branchService.update(p(req.params, 'id'), req.body);
      res.json({ success: true, data: branch });
    } catch (error) {
      next(error);
    }
  },

  updateFiscalConfig: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const config = await branchService.updateFiscalConfig(p(req.params, 'id'), req.body);
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  },
};
