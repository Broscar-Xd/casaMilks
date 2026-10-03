import { prisma } from '../config/database';

export const tableRepository = {
  listByBranch: async (branchId: string) => {
    const tables = await prisma.table.findMany({
      where: { branchId },
      include: {
        orders: {
          where: { status: 'OPEN' },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    // Auto-reconciliación bidireccional:
    // 1) Si tiene órdenes OPEN pero dice 'FREE' -> reportar 'OCCUPIED' y sincronizar
    // 2) Si NO tiene órdenes OPEN pero dice 'OCCUPIED' -> reportar 'FREE' y sincronizar
    return tables.map(t => {
      const hasOpen = t.orders && t.orders.length > 0;
      let status = t.status;
      if (hasOpen && t.status === 'FREE') {
        status = 'OCCUPIED';
        prisma.table.update({ where: { id: t.id }, data: { status: 'OCCUPIED' } }).catch(() => {});
      } else if (!hasOpen && t.status === 'OCCUPIED') {
        status = 'FREE';
        prisma.table.update({ where: { id: t.id }, data: { status: 'FREE' } }).catch(() => {});
      }
      return {
        id: t.id,
        branchId: t.branchId,
        name: t.name,
        status,
        active: t.active,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  },

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
