import { prisma } from '../config/database';

export const receiptRepository = {
  /** Lista los comprobantes electrónicos de un local (con datos de la orden). */
  listByBranch: (branchId: string) =>
    prisma.electronicReceipt.findMany({
      where: { branchId },
      include: {
        order: {
          select: {
            id: true,
            invoiceName: true,
            invoiceDocId: true,
            total: true,
            createdAt: true,
            table: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  /** Busca un comprobante por id. */
  findById: (id: string) =>
    prisma.electronicReceipt.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            invoiceName: true,
            invoiceDocId: true,
            total: true,
            createdAt: true,
            table: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
      },
    }),
};
