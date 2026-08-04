import { Response, NextFunction } from 'express';
import { customerService } from '../services/customer.service';
import { AuthenticatedRequest } from '../types';

export const customerController = {
  /** GET /api/customers?branchId=&search= — sugerencias de clientes del local */
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const branchId = String(req.query.branchId || '');
      const search = req.query.search ? String(req.query.search) : undefined;
      if (!branchId) {
        res.status(400).json({ success: false, error: 'branchId requerido' });
        return;
      }
      const data = await customerService.list(branchId, search);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/customers — guarda o actualiza un cliente (upsert por docId) */
  upsert: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await customerService.upsert(req.body);
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  },
};
