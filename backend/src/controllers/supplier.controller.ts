import { Response, NextFunction } from 'express';
import { supplierService } from '../services/supplier.service';
import { AuthenticatedRequest } from '../types';

export const supplierController = {
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, dateFrom, dateTo, supplierName } = req.query;
      const payments = await supplierService.list(branchId as string, dateFrom as string, dateTo as string, supplierName as string);
      res.json({ success: true, data: payments });
    } catch (error) { next(error); }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const payment = await supplierService.create({ ...req.body, branchId: req.body.branchId });
      res.status(201).json({ success: true, data: payment });
    } catch (error) { next(error); }
  },

  listSuppliers: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const suppliers = await supplierService.listSuppliers(branchId as string);
      res.json({ success: true, data: suppliers });
    } catch (error) { next(error); }
  },

  /** GET /api/suppliers/sum?branchId=&date= — total pagado a proveedores en el día */
  sumByDate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, date } = req.query;
      const data = await supplierService.sumByDate(branchId as string, date as string);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  },

  /** DELETE /api/suppliers/:id — elimina un pago registrado por error */
  remove: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await supplierService.remove(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  },
};
