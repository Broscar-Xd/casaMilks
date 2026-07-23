import { orderRepository } from '../repositories/order.repository';
import { tableRepository } from '../repositories/table.repository';
import { inventoryRepository } from '../repositories/inventory.repository';
import { branchRepository } from '../repositories/branch.repository';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import { CreateTableOrderInput, AddItemsToOrderInput, CloseOrderInput } from '../validators/order.validator';

export const orderService = {
  getById: async (id: string) => {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError('Pedido no encontrado', 404);
    return order;
  },

  getByTable: async (tableId: string) => {
    const order = await orderRepository.findByTable(tableId);
    return order;
  },

  listByBranch: (branchId: string, dateFrom?: string, dateTo?: string) => {
    const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
    const parsedDateTo = dateTo ? new Date(dateTo) : undefined;
    return orderRepository.listByBranch(branchId, parsedDateFrom, parsedDateTo);
  },

  getKitchenSends: (branchId: string) => orderRepository.getKitchenSends(branchId),

  /**
   * Crea un pedido para una mesa. Si la mesa está FREE, pasa a OCCUPIED.
   * Los productos que requieren preparación se envían a cocina automáticamente.
   */
  create: async (input: CreateTableOrderInput, userId: string) => {
    const table = await tableRepository.findById(input.tableId);
    if (!table) throw new AppError('Mesa no encontrada', 404);
    if (table.status !== 'FREE') throw new AppError('La mesa no está disponible');

    // Crear la orden
    const order = await orderRepository.create({
      branchId: input.branchId,
      tableId: input.tableId,
      userId,
      customerName: input.customerName,
      notes: input.notes,
      items: input.items,
    });

    // Marcar mesa como ocupada
    await tableRepository.updateStatus(input.tableId, 'OCCUPIED');

    // Enviar a cocina los productos que requieren preparación
    await sendToKitchen(order.id, input.items);

    return orderRepository.findById(order.id);
  },

  /**
   * Agrega productos a una orden existente (mesa ocupada).
   * Solo los productos nuevos se envían a cocina.
   */
  addItems: async (orderId: string, input: AddItemsToOrderInput) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError('Pedido no encontrado', 404);
    if (order.status !== 'OPEN') throw new AppError('El pedido ya está cerrado');

    const createdItems = await orderRepository.addItems(orderId, input.items);

    // Enviar a cocina solo los productos que requieren preparación
    await sendToKitchen(orderId, input.items);

    return orderRepository.findById(orderId);
  },

  /**
   * Marca un envío de cocina como listo.
   */
  markKitchenReady: async (sendId: string) => {
    return orderRepository.markKitchenSendReady(sendId);
  },

  /**
   * Cierra el pedido de una mesa: registra pagos, descuenta inventario,
   * emite nota de venta y libera la mesa.
   */
  close: async (orderId: string, input: CloseOrderInput, userId: string) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError('Pedido no encontrado', 404);
    if (order.status !== 'OPEN') throw new AppError('El pedido ya está cerrado');

    const paymentTotal = input.payments.reduce((s, p) => s + Number(p.amount), 0);
    if (Math.abs(paymentTotal - Number(order.total)) > 0.01) {
      throw new AppError('El total de los pagos no coincide con el total del pedido');
    }

    // 1. Registrar pagos y cerrar la orden (transacción corta)
    const year = new Date().getFullYear();
    const seq = await branchRepository.getNextSequential(order.branchId, year);

    await prisma.$transaction(async (tx) => {
      for (const p of input.payments) {
        await tx.payment.create({
          data: {
            orderId, method: p.method, amount: p.amount,
            referenceNumber: p.referenceNumber, cashReceived: p.cashReceived, cashChange: p.cashChange,
          },
        });
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'CLOSED' } });
      await tx.electronicReceipt.create({
        data: {
          orderId, branchId: order.branchId, sequential: seq,
          authorization: `CASAMILKS-${year}-${String(seq).padStart(9, '0')}`,
          status: 'EMITTED',
        },
      });
      await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
    });

    // 2. Descontar inventario (fuera de transacción — operaciones lentas)
    const items = await prisma.orderItem.findMany({
      where: { orderId },
      include: { product: { include: { recipes: true } } },
    });

    for (const item of items) {
      for (const recipe of item.product.recipes) {
        const qty = Number(recipe.quantity) * item.quantity;
        const stock = await prisma.inventoryItem.findUnique({
          where: { ingredientId_branchId: { ingredientId: recipe.ingredientId, branchId: order.branchId } },
        });
        if (stock) {
          const newQty = Number(stock.quantity) - qty;
          await prisma.inventoryItem.update({ where: { id: stock.id }, data: { quantity: Math.max(0, newQty) } });
        }
        await prisma.inventoryMovement.create({
          data: {
            ingredientId: recipe.ingredientId, branchId: order.branchId,
            type: 'OUT', quantity: qty, reference: `Pedido #${orderId.slice(0, 8)}`, orderId,
          },
        });
      }
    }

    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, payments: true, table: true },
    });
  },
};

/**
 * Envía a cocina los productos que requieren preparación.
 * Crea un KitchenSend con solo esos items.
 */
async function sendToKitchen(orderId: string, items: Array<{ productId: string; quantity: number }>) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map(i => i.productId) } },
    select: { id: true, requiresPreparation: true },
  });

  const prepMap = new Map(products.map(p => [p.id, p.requiresPreparation]));
  const kitchenItems = items
    .filter(i => prepMap.get(i.productId) !== false)
    .map(i => ({ productId: i.productId, quantity: i.quantity }));

  if (kitchenItems.length > 0) {
    await orderRepository.createKitchenSend(orderId, kitchenItems);
  }
}
