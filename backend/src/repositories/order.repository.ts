import { prisma } from '../config/database';

type KitchenSendInputItem = {
  productId: string;
  quantity: number;
  orderItemId?: string | null;
  comboSelections?: Array<{ productId: string; productName: string; quantity?: number; lineLabel?: string | null }>;
};

const KITCHEN_SEND_INCLUDE = {
  items: {
    include: {
      product: { include: { category: true } },
      comboItems: { include: { product: { select: { id: true, name: true } } } },
    },
  },
} as const;

/** Crea los items de un envío y liga sus selecciones de combo al item padre. */
async function createSendItems(tx: any, sendId: string, items: KitchenSendInputItem[]) {
  const createdItems: Array<{ id: string }> = [];
  for (const item of items) {
    createdItems.push(await tx.kitchenSendItem.create({
      data: { sendId, productId: item.productId, quantity: item.quantity, orderItemId: item.orderItemId || null },
    }));
  }
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item.comboSelections || item.comboSelections.length === 0) continue;
    await tx.kitchenSendCombo.createMany({
      data: item.comboSelections.map(sel => ({
        kitchenSendId: sendId,
        kitchenSendItemId: createdItems[idx].id,
        productId: sel.productId,
        productName: sel.productName,
        quantity: sel.quantity || item.quantity,
        lineLabel: sel.lineLabel || null,
      })),
    });
  }
}

export const orderRepository = {
  findById: (id: string) =>
    prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { category: true } }, comboItems: true } },
        payments: true,
        kitchenSends: {
          include: { items: { include: { product: { include: { category: true } } } }, comboItems: true },
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
        items: { include: { product: { include: { category: true } }, comboItems: true } },
        payments: true,
        kitchenSends: {
          include: { items: { include: { product: { include: { category: true } } } }, comboItems: true },
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
        items: { include: { product: { include: { category: true } }, comboItems: true } },
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
            product: { include: { category: true } },
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
        },
      });
      // Crear items uno a uno (createManyAndReturn preserva el orden de entrada,
      // necesario para mapear combos y envíos a cocina correctamente)
      const items = await tx.orderItem.createManyAndReturn({
        data: data.items.map(i => ({
          orderId: order.id,
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
          sentToKitchen: false,
        })),
      });
      return { order, items };
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

  createKitchenSend: (orderId: string, items: KitchenSendInputItem[]) =>
    prisma.$transaction(async (tx) => {
      const send = await tx.kitchenSend.create({
        data: { orderId },
      });
      await createSendItems(tx, send.id, items);
      return tx.kitchenSend.findUnique({
        where: { id: send.id },
        include: KITCHEN_SEND_INCLUDE,
      });
    }),

  /** Último envío PENDING de la orden (para agregar items nuevos al mismo envío). */
  findPendingKitchenSend: (orderId: string) =>
    prisma.kitchenSend.findFirst({
      where: { orderId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),

  /** Agrega items a un envío de cocina YA EXISTENTE (no crea uno nuevo). */
  appendToKitchenSend: (sendId: string, items: KitchenSendInputItem[]) =>
    prisma.$transaction(async (tx) => {
      await createSendItems(tx, sendId, items);
      return tx.kitchenSend.findUnique({
        where: { id: sendId },
        include: KITCHEN_SEND_INCLUDE,
      });
    }),

  /**
   * Quita un item de los envíos PENDING de la orden (cuando se elimina de la
   * orden). Si el envío queda vacío, se elimina.
   */
  removeKitchenItem: (orderId: string, orderItemId: string) =>
    prisma.$transaction(async (tx) => {
      const items = await tx.kitchenSendItem.findMany({
        where: { orderItemId, send: { orderId, status: 'PENDING' } },
        select: { id: true, sendId: true },
      });
      if (items.length === 0) return;
      await tx.kitchenSendCombo.deleteMany({ where: { kitchenSendItemId: { in: items.map(i => i.id) } } });
      await tx.kitchenSendItem.deleteMany({ where: { id: { in: items.map(i => i.id) } } });
      // Envíos pendientes que quedaron vacíos ya no se muestran en cocina
      const sendIds = [...new Set(items.map(i => i.sendId))];
      await tx.kitchenSend.deleteMany({ where: { id: { in: sendIds }, items: { none: {} } } });
    }),

  /**
   * Elimina un item de cocina por su id (envíos viejos sin vínculo a la orden).
   * Si el envío queda vacío, se elimina. Útil cuando el item de la orden ya no
   * existe (eliminado antes) y solo queda la tarjeta vieja en cocina.
   */
  removeKitchenSendItemById: (sendItemId: string) =>
    prisma.$transaction(async (tx) => {
      const si = await tx.kitchenSendItem.findUnique({ where: { id: sendItemId }, select: { id: true, sendId: true } });
      if (!si) return;
      await tx.kitchenSendCombo.deleteMany({ where: { kitchenSendItemId: si.id } });
      await tx.kitchenSendItem.delete({ where: { id: si.id } });
      await tx.kitchenSend.deleteMany({ where: { id: si.sendId, items: { none: {} } } });
    }),

  /**
   * Sincroniza cantidad y/o selecciones de combo de un item en los envíos
   * PENDING de la orden (cuando se edita desde POS o cocina).
   */
  syncKitchenItem: (orderId: string, orderItemId: string, data: { quantity: number; comboSelections?: Array<{ productId: string; productName: string; lineLabel?: string | null }> }) =>
    prisma.$transaction(async (tx) => {
      const items = await tx.kitchenSendItem.findMany({
        where: { orderItemId, send: { orderId, status: 'PENDING' } },
        select: { id: true, sendId: true },
      });
      if (items.length === 0) return;
      await tx.kitchenSendItem.updateMany({
        where: { id: { in: items.map(i => i.id) } },
        data: { quantity: data.quantity },
      });
      if (data.comboSelections) {
        await tx.kitchenSendCombo.deleteMany({ where: { kitchenSendItemId: { in: items.map(i => i.id) } } });
        for (const ki of items) {
          await tx.kitchenSendCombo.createMany({
            data: data.comboSelections.map(sel => ({
              kitchenSendId: ki.sendId,
              kitchenSendItemId: ki.id,
              productId: sel.productId,
              productName: sel.productName,
              quantity: data.quantity,
              lineLabel: sel.lineLabel || null,
            })),
          });
        }
      }
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
