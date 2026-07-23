import { prisma } from '../config/database';

export const orderRepository = {
  findById: (id: string) =>
    prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: true,
        kitchenSends: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, name: true } },
        table: true,
      },
    }),

  findByTable: (tableId: string) =>
    prisma.order.findFirst({
      where: { tableId, status: { not: 'CLOSED' } },
      include: {
        items: { include: { product: true } },
        payments: true,
        kitchenSends: { include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } },
      },
    }),

  listByBranch: (branchId: string, dateFrom?: Date, dateTo?: Date) =>
    prisma.order.findMany({
      where: {
        branchId,
        ...(dateFrom || dateTo
          ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
          : {}),
      },
      include: {
        items: { include: { product: true } },
        payments: true,
        table: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

  getKitchenSends: (branchId: string) =>
    prisma.kitchenSend.findMany({
      where: {
        order: { branchId },
        status: 'PENDING',
      },
      include: {
        items: { include: { product: true } },
        order: { select: { id: true, tableId: true, table: { select: { name: true } }, notes: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

  create: (data: {
    branchId: string; tableId: string; userId: string; customerName?: string | null;
    notes?: string | null; items: Array<{ productId: string; quantity: number; unitPrice: number; subtotal: number }>;
  }) =>
    prisma.$transaction(async (tx) => {
      const total = data.items.reduce((s, i) => s + Number(i.subtotal), 0);
      const order = await tx.order.create({
        data: {
          branchId: data.branchId,
          tableId: data.tableId,
          userId: data.userId,
          customerName: data.customerName,
          notes: data.notes,
          status: 'OPEN',
          total,
          items: { create: data.items.map(i => ({ ...i, sentToKitchen: false })) },
        },
      });
      return order;
    }),

  addItems: (orderId: string, items: Array<{ productId: string; quantity: number; unitPrice: number; subtotal: number }>) =>
    prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { total: true } });
      if (!order) throw new Error('Pedido no encontrado');
      const addTotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
      const newTotal = Number(order.total) + addTotal;
      await tx.order.update({ where: { id: orderId }, data: { total: newTotal } });
      const created = await tx.orderItem.createManyAndReturn({
        data: items.map(i => ({ orderId, ...i, sentToKitchen: false })),
      });
      return created;
    }),

  createKitchenSend: (orderId: string, items: Array<{ productId: string; quantity: number }>) =>
    prisma.kitchenSend.create({
      data: {
        orderId,
        items: { create: items },
      },
      include: { items: { include: { product: true } } },
    }),

  markKitchenSendReady: (sendId: string) =>
    prisma.kitchenSend.update({
      where: { id: sendId },
      data: { status: 'READY' },
    }),

  markItemsSent: (orderId: string, itemIds: string[]) =>
    prisma.orderItem.updateMany({
      where: { id: { in: itemIds }, orderId },
      data: { sentToKitchen: true },
    }),

  close: (orderId: string, total: number) =>
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'CLOSED', total },
    }),

  countByBranchAndDate: (branchId: string, date: Date) => {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    return prisma.order.count({
      where: { branchId, createdAt: { gte: start, lte: end }, status: 'CLOSED' },
    });
  },

  sumByBranchAndDate: (branchId: string, date: Date) => {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    return prisma.order.aggregate({
      where: { branchId, createdAt: { gte: start, lte: end }, status: 'CLOSED' },
      _sum: { total: true },
    });
  },
};
