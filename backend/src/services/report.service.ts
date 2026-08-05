import { reportRepository } from '../repositories/report.repository';
import { prisma } from '../config/database';
import ExcelJS from 'exceljs';

/**
 * Convierte "YYYY-MM-DD" al inicio del día (00:00:00.000).
 */
function startOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000`);
  return d;
}

/**
 * Convierte "YYYY-MM-DD" al FIN del día (23:59:59.999).
 * Sin esto, el filtro lte con medianoche excluye todo el día.
 */
function endOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d;
}

export const reportService = {
  salesByProduct: (branchId: string, dateFrom: string, dateTo: string) =>
    reportRepository.salesByProduct(branchId, startOfDay(dateFrom), endOfDay(dateTo)),

  salesByTimeSlot: (branchId: string, date: string) =>
    reportRepository.salesByTimeSlot(branchId, new Date(`${date}T12:00:00`)),

  dailySummary: (branchId: string, dateFrom: string, dateTo: string) =>
    reportRepository.dailySummary(branchId, startOfDay(dateFrom), endOfDay(dateTo)),

  paymentsByMethod: (branchId: string, dateFrom: string, dateTo: string) =>
    reportRepository.paymentsByMethod(branchId, startOfDay(dateFrom), endOfDay(dateTo)),

  /**
   * Genera un archivo Excel con los datos del reporte solicitado.
   * Retorna el buffer del archivo listo para descargar.
   */
  exportToExcel: async (branchId: string, dateFrom: string, dateTo: string) => {
    const sales = await reportRepository.salesByProduct(
      branchId,
      startOfDay(dateFrom),
      endOfDay(dateTo)
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
