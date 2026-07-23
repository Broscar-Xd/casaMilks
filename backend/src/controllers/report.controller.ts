import { Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';
import { AuthenticatedRequest } from '../types';

export const reportController = {
  salesByProduct: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, dateFrom, dateTo } = req.query;
      const data = await reportService.salesByProduct(
        branchId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  salesByTimeSlot: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, date } = req.query;
      const data = await reportService.salesByTimeSlot(branchId as string, date as string);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  paymentsByMethod: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, dateFrom, dateTo } = req.query;
      const data = await reportService.paymentsByMethod(
        branchId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Exporta un reporte de ventas por producto a Excel.
   * Retorna el archivo como descarga binaria.
   */
  exportToExcel: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { branchId, dateFrom, dateTo } = req.query;
      const buffer = await reportService.exportToExcel(
        branchId as string,
        dateFrom as string,
        dateTo as string
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=reporte-ventas-${dateFrom}-${dateTo}.xlsx`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  },
};
