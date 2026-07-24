import { Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { AuthenticatedRequest } from '../types';

const p = (params: Record<string, string | string[]>, key: string): string =>
  Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string);

export const orderController = {
  listByBranch: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, dateFrom, dateTo } = req.query;
      const orders = await orderService.listByBranch(branchId as string, dateFrom as string, dateTo as string);
      res.json({ success: true, data: orders });
    } catch (error) { next(error); }
  },

  getByTable: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.getByTable(p(req.params, 'tableId'));
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  },

  getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.getById(p(req.params, 'id'));
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.create(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: order });
    } catch (error) { next(error); }
  },

  createTakeout: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.createTakeout(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: order });
    } catch (error) { next(error); }
  },

  addItems: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.addItems(p(req.params, 'id'), req.body);
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  },

  getKitchenSends: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const sends = await orderService.getKitchenSends(branchId as string);
      res.json({ success: true, data: sends });
    } catch (error) { next(error); }
  },

  markKitchenReady: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const send = await orderService.markKitchenReady(p(req.params, 'sendId'));
      res.json({ success: true, data: send });
    } catch (error) { next(error); }
  },

  close: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.close(p(req.params, 'id'), req.body, req.user!.userId);
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  },
};
