import { prisma } from '../config/database';

export const orderRepository = {
  findById: (id: string) =>
    prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, comboItems: true } },
        payments: true,
        kitchenSends: {
          include: { items: { include: { product: true } }, comboItems: true },
          orderBy: { createdAt: 'desc' },
        },
        user: { select: { id: true, name: true } },
        table: true,
      },
    }),

  findByTable: (tableId: string) =>
    prisma.order.findFirst({
      where: { tableId, status: { not: 'CLOSED' } },
      include: {
        items: { include: { product: true, comboItems: true } },
        payments: true,
        kitchenSends: {
          include: { items: { include: { product: true } }, comboItems: true },
          orderBy: { createdAt: 'desc' },
        },
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
        items: { include: { product: true, comboItems: true } },
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
        items: {
          include: {
            product: true,
            comboItems: { include: { product: { select: { id: true, name: true } } } },
          },
        },
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
          items: { create: data.items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal,
            sentToKitchen: false,
          })) },
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
        data: items.map(i => ({
          orderId, productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal, sentToKitchen: false,
        })),
      });
      return created;
    }),

  createKitchenSend: (orderId: string, items: Array<{ productId: string; quantity: number; comboSelections?: Array<{ productId: string; productName: string; quantity?: number; lineLabel?: string | null }> }>) =>
    prisma.$transaction(async (tx) => {
      const send = await tx.kitchenSend.create({
        data: { orderId },
      });
      // Crear items uno a uno para capturar sus IDs y ligar los combos a su item padre
      const createdItems: Array<{ id: string }> = [];
      for (const item of items) {
        createdItems.push(await tx.kitchenSendItem.create({
          data: { sendId: send.id, productId: item.productId, quantity: item.quantity },
        }));
      }
      if (items.some(i => i.comboSelections && i.comboSelections.length > 0)) {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          if (!item.comboSelections || item.comboSelections.length === 0) continue;
          await tx.kitchenSendCombo.createMany({
            data: item.comboSelections.map(sel => ({
              kitchenSendId: send.id,
              kitchenSendItemId: createdItems[idx].id,
              productId: sel.productId,
              productName: sel.productName,
              quantity: sel.quantity || item.quantity,
              lineLabel: sel.lineLabel || null,
            })),
          });
        }
      }
      return tx.kitchenSend.findUnique({
        where: { id: send.id },
        include: {
          items: {
            include: {
              product: true,
              comboItems: { include: { product: { select: { id: true, name: true } } } },
            },
          },
        },
      });
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
