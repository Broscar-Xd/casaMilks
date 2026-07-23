import { Response, NextFunction } from 'express';
import { tableService } from '../services/table.service';
import { AuthenticatedRequest } from '../types';

export const tableController = {
  listByBranch: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const tables = await tableService.listByBranch(branchId as string);
      res.json({ success: true, data: tables });
    } catch (error) { next(error); }
  },

  getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const table = await tableService.getById(req.params.id as string);
      res.json({ success: true, data: table });
    } catch (error) { next(error); }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const table = await tableService.create(req.body);
      res.status(201).json({ success: true, data: table });
    } catch (error) { next(error); }
  },

  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const table = await tableService.update(req.params.id as string, req.body);
      res.json({ success: true, data: table });
    } catch (error) { next(error); }
  },

  delete: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await tableService.delete(req.params.id as string);
      res.json({ success: true, message: 'Mesa eliminada' });
    } catch (error) { next(error); }
  },
};
