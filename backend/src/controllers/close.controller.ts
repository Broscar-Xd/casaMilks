import { Response, NextFunction } from 'express';
import { closeService } from '../services/close.service';
import { AuthenticatedRequest } from '../types';

export const closeController = {
  execute: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await closeService.execute(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const closes = await closeService.list(branchId as string);
      res.json({ success: true, data: closes });
    } catch (error) {
      next(error);
    }
  },

  getByDate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, date } = req.query;
      const close = await closeService.getByDate(branchId as string, date as string);
      res.json({ success: true, data: close });
    } catch (error) {
      next(error);
    }
  },
};
