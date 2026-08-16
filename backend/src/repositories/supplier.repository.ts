import { prisma } from '../config/database';

export const supplierRepository = {
  list: (branchId: string, dateFrom?: Date, dateTo?: Date, supplierName?: string) =>
    prisma.supplierPayment.findMany({
      where: {
        branchId,
        ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
        ...(supplierName ? { supplierName: { contains: supplierName } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    }),

  create: (data: {
    branchId: string; supplierName: string; cashAmount: number; transferAmount: number; total: number; notes?: string | null;
  }) => prisma.supplierPayment.create({
    data: {
      supplierName: data.supplierName,
      cashAmount: data.cashAmount,
      transferAmount: data.transferAmount,
      total: data.total,
      notes: data.notes,
      branch: { connect: { id: data.branchId } },
    },
  }),

  listSuppliers: (branchId: string) =>
    prisma.supplierPayment.findMany({
      where: { branchId },
      select: { supplierName: true },
      distinct: ['supplierName'],
      orderBy: { supplierName: 'asc' },
    }),

  findById: (id: string) => prisma.supplierPayment.findUnique({ where: { id } }),

  /** Elimina un pago a proveedor (para corregir registros digitados por error). */
  remove: (id: string) => prisma.supplierPayment.delete({ where: { id } }),

  /** Suma el total pagado a proveedores en un rango de fechas (con desglose). */
  sumByDate: (branchId: string, dateFrom: Date, dateTo: Date) =>
    prisma.supplierPayment.aggregate({
      where: {
        branchId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _sum: { total: true, cashAmount: true, transferAmount: true },
    }),
};
