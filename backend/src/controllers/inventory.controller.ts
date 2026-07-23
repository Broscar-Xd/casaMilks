import { Response, NextFunction } from 'express';
import { inventoryService } from '../services/inventory.service';
import { AuthenticatedRequest } from '../types';

export const inventoryController = {
  getByBranch: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const items = await inventoryService.getByBranch(branchId as string);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  },

  getAlerts: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const alerts = await inventoryService.getAlerts(branchId as string);
      res.json({ success: true, data: alerts });
    } catch (error) {
      next(error);
    }
  },

  getMovements: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, ingredientId } = req.query;
      const movements = await inventoryService.getMovements(
        branchId as string,
        ingredientId as string | undefined
      );
      res.json({ success: true, data: movements });
    } catch (error) {
      next(error);
    }
  },

  adjust: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.adjust(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
