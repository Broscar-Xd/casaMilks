import { Response, NextFunction } from 'express';
import { receiptService } from '../services/receipt.service';
import { generarNotaVentaPdf } from '../services/receiptPdf.service';
import { AuthenticatedRequest } from '../types';

export const receiptController = {
  /** GET /api/receipts?branchId= — lista facturas de un local */
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const branchId = String(req.query.branchId || '');
      if (!branchId) {
        res.status(400).json({ success: false, error: 'branchId requerido' });
        return;
      }
      const data = await receiptService.list(branchId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/receipts/:id/resend — vuelve a enviar una factura al SRI */
  resend: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await receiptService.resend(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/receipts/:id/status — consulta el estado en el SRI */
  checkStatus: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await receiptService.checkStatus(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/receipts/:id/xml — obtiene el XML de una factura */
  getXml: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await receiptService.getXml(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/receipts/:id/pdf — descarga la nota de venta en PDF */
  getPdf: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const pdf = await generarNotaVentaPdf({ receiptId: req.params.id });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nota_venta_${req.params.id.slice(0, 8)}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  },
};
