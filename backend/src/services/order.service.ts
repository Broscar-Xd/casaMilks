import { orderRepository } from '../repositories/order.repository';
import { tableRepository } from '../repositories/table.repository';
import { inventoryRepository } from '../repositories/inventory.repository';
import { branchRepository } from '../repositories/branch.repository';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import { CreateTableOrderInput, CreateTakeoutOrderInput, AddItemsToOrderInput, CloseOrderInput } from '../validators/order.validator';
import { startOfEcuadorDay, endOfEcuadorDay } from '../utils/date';

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
    // dateFrom → inicio del día (00:00:00.000) y dateTo → fin (23:59:59.999),
    // ambos en hora de Ecuador (UTC-5). Sin esto, filtrar por un día
    // excluye todo lo posterior a las 19:00 (server en UTC).
    const parsedDateFrom = dateFrom ? startOfEcuadorDay(dateFrom) : undefined;
    const parsedDateTo = dateTo ? endOfEcuadorDay(dateTo) : undefined;
    return orderRepository.listByBranch(branchId, parsedDateFrom, parsedDateTo);
  },

  getKitchenSends: (branchId: string) => orderRepository.getKitchenSends(branchId),

  /**
   * Crea un pedido para una mesa. Si la mesa está FREE, pasa a OCCUPIED.
   * Los productos que requieren preparación se envían a cocina automáticamente.
   */
  /**
   * Crea un pedido para llevar (sin mesa). Solo requiere nombre de cliente.
   */
  createTakeout: async (input: CreateTakeoutOrderInput, userId: string) => {
    const order = await prisma.order.create({
      data: {
        branchId: input.branchId,
        userId,
        customerName: input.customerName,
        notes: input.notes,
        status: 'OPEN',
        total: input.items.reduce((s, i) => s + Number(i.subtotal), 0),
        items: { create: input.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal, sentToKitchen: false })) },
      },
    });

    // Create OrderItemCombo records
    await createOrderItemCombos(order.id, input.items);

    // Enviar a cocina productos que requieren preparación
    await sendToKitchen(order.id, input.items);

    return orderRepository.findById(order.id);
  },

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

    // Create OrderItemCombo records
    await createOrderItemCombos(order.id, input.items);

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

    // Create OrderItemCombo records
    await createOrderItemCombos(orderId, input.items);

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

    // Bloquear el cobro si hay productos pendientes en cocina
    const kitchenPending = (order.kitchenSends || []).some((s) => s.status === 'PENDING');
    if (kitchenPending) {
      throw new AppError('No se puede cobrar: hay productos en preparación en cocina. Espera a que estén listos.');
    }

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

      // Update order with invoice data if provided, and close
      const updateData: any = { status: 'CLOSED' };
      if (input.invoice) {
        updateData.invoiceName = input.invoice.invoiceName;
        updateData.invoiceDocId = input.invoice.invoiceDocId;
        updateData.invoiceEmail = input.invoice.invoiceEmail || null;
        updateData.invoicePhone = input.invoice.invoicePhone || null;
        updateData.invoiceAddress = input.invoice.invoiceAddress || 'Latacunga';
      }
      await tx.order.update({ where: { id: orderId }, data: updateData });
      await tx.electronicReceipt.create({
        data: {
          orderId, branchId: order.branchId, sequential: seq,
          authorization: `CASAMILKS-${year}-${String(seq).padStart(9, '0')}`,
          status: 'EMITTED',
        },
      });
      if (order.tableId) {
        await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
      }
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
      include: { items: { include: { product: true, comboItems: true } }, payments: true, table: true },
    });
  },

  updateInvoice: async (orderId: string, input: { invoiceName: string; invoiceDocId: string; invoiceEmail?: string; invoicePhone?: string; invoiceAddress?: string }) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError('Pedido no encontrado', 404);

    return prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceName: input.invoiceName,
        invoiceDocId: input.invoiceDocId,
        invoiceEmail: input.invoiceEmail || null,
        invoicePhone: input.invoicePhone || null,
        invoiceAddress: input.invoiceAddress || 'Latacunga',
      },
    });
  },
};

/**
 * Crea registros OrderItemCombo para cada item que tenga comboSelections.
 */
async function createOrderItemCombos(orderId: string, items: Array<{ productId: string; quantity: number; comboSelections?: Array<{ productId: string; productName: string; lineLabel?: string }> }>) {
  const itemsWithCombos = items.filter(i => i.comboSelections && i.comboSelections.length > 0);
  if (itemsWithCombos.length === 0) return;

  // Fetch created order items to map them
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    orderBy: { id: 'asc' },
  });

  const used = new Set<string>();
  for (const inputItem of itemsWithCombos) {
    // Find first unmatched OrderItem with this productId
    const orderItem = orderItems.find(oi => oi.productId === inputItem.productId && !used.has(oi.id));
    if (!orderItem) continue;
    used.add(orderItem.id);

    for (const sel of inputItem.comboSelections!) {
      // Check if OrderItemCombo already exists
      const existing = await prisma.orderItemCombo.findFirst({
        where: { orderItemId: orderItem.id, productId: sel.productId },
      });
      if (!existing) {
        await prisma.orderItemCombo.create({
          data: {
            orderItemId: orderItem.id,
            productId: sel.productId,
            productName: sel.productName,
            // Si el desayuno/combo va x2, cada selección también va x2
            quantity: inputItem.quantity,
            lineLabel: sel.lineLabel || null,
          },
        });
      } else {
        // Si ya existía (mismo combo agregado 2 veces), acumular la cantidad
        await prisma.orderItemCombo.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + inputItem.quantity },
        });
      }
    }
  }
}

/**
 * Envía a cocina los productos que requieren preparación.
 * Crea un KitchenSend con los items y sus desgloses de combo.
 */
async function sendToKitchen(orderId: string, items: Array<{ productId: string; quantity: number; comboSelections?: Array<{ productId: string; productName: string; lineLabel?: string }> }>) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map(i => i.productId) } },
    select: { id: true, requiresPreparation: true },
  });

  const prepMap = new Map(products.map(p => [p.id, p.requiresPreparation]));
  const kitchenItems = items
    .filter(i => prepMap.get(i.productId) !== false)
    .map(i => ({ productId: i.productId, quantity: i.quantity }));

  if (kitchenItems.length === 0) return;

  // Collect combo selections for items going to kitchen
  const kitchenComboItems: Array<{ productId: string; productName: string; quantity: number; lineLabel?: string | null }> = [];
  for (const item of items) {
    if (prepMap.get(item.productId) === false) continue;
    if (item.comboSelections && item.comboSelections.length > 0) {
      for (const sel of item.comboSelections) {
        kitchenComboItems.push({
          productId: sel.productId,
          productName: sel.productName,
          // Cantidad del combo multiplicada (x2 desayunos = x2 de cada selección)
          quantity: item.quantity,
          lineLabel: sel.lineLabel || null,
        });
      }
    }
  }

  await orderRepository.createKitchenSend(orderId, kitchenItems, kitchenComboItems);
}
