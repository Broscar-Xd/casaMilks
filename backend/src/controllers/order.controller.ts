import { Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { emitirFacturaElectronica } from '../services/sri/sri.service';
import { generarNotaVentaPdf } from '../services/receiptPdf.service';
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

  updateInvoice: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.updateInvoice(p(req.params, 'id'), req.body);
      res.json({ success: true, data: order });
    } catch (error) { next(error); }
  },

  emitInvoice: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await emitirFacturaElectronica(p(req.params, 'id'));
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  },

  /** GET /api/orders/:id/pdf — descarga la nota de venta del pedido (con o sin factura) */
  getPdf: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const pdf = await generarNotaVentaPdf({ orderId: p(req.params, 'id') });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nota_venta_${req.params.id.slice(0, 8)}.pdf"`);
      res.send(pdf);
    } catch (error) { next(error); }
  },
};
