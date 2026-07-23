import { reportRepository } from '../repositories/report.repository';
import { prisma } from '../config/database';
import ExcelJS from 'exceljs';

export const reportService = {
  salesByProduct: (branchId: string, dateFrom: string, dateTo: string) =>
    reportRepository.salesByProduct(branchId, new Date(dateFrom), new Date(dateTo)),

  salesByTimeSlot: (branchId: string, date: string) =>
    reportRepository.salesByTimeSlot(branchId, new Date(date)),

  dailySummary: (branchId: string, dateFrom: string, dateTo: string) =>
    reportRepository.dailySummary(branchId, new Date(dateFrom), new Date(dateTo)),

  paymentsByMethod: (branchId: string, dateFrom: string, dateTo: string) =>
    reportRepository.paymentsByMethod(branchId, new Date(dateFrom), new Date(dateTo)),

  /**
   * Genera un archivo Excel con los datos del reporte solicitado.
   * Retorna el buffer del archivo listo para descargar.
   */
  exportToExcel: async (branchId: string, dateFrom: string, dateTo: string) => {
    const sales = await reportRepository.salesByProduct(
      branchId,
      new Date(dateFrom),
      new Date(dateTo)
    );

    const productIds = sales.map((s) => s.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ventas por Producto');

    sheet.columns = [
      { header: 'Producto', key: 'product', width: 30 },
      { header: 'Unidades Vendidas', key: 'quantity', width: 20 },
      { header: 'Total Venta', key: 'total', width: 20 },
    ];

    sales.forEach((sale) => {
      sheet.addRow({
        product: productMap.get(sale.productId) || 'Desconocido',
        quantity: sale._sum.quantity || 0,
        total: Number(sale._sum.subtotal || 0).toFixed(2),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  },
};
