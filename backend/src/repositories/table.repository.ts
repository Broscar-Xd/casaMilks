import { prisma } from '../config/database';

export const tableRepository = {
  listByBranch: (branchId: string) =>
    prisma.table.findMany({
      where: { branchId },
      orderBy: { name: 'asc' },
    }),

  findById: (id: string) =>
    prisma.table.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: { not: 'CLOSED' } },
          include: {
            items: { include: { product: true } },
            payments: true,
            kitchenSends: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    }),

  findActiveOrder: (tableId: string) =>
    prisma.order.findFirst({
      where: { tableId, status: { not: 'CLOSED' } },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    }),

  create: (data: { name: string; branchId: string }) =>
    prisma.table.create({ data }),

  update: (id: string, data: { name?: string; active?: boolean }) =>
    prisma.table.update({ where: { id }, data }),

  updateStatus: (id: string, status: string) =>
    prisma.table.update({ where: { id }, data: { status } }),

  delete: (id: string) =>
    prisma.table.delete({ where: { id } }),
};
