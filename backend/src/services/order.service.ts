import { orderRepository } from '../repositories/order.repository';
import { tableRepository } from '../repositories/table.repository';
import { inventoryRepository } from '../repositories/inventory.repository';
import { branchRepository } from '../repositories/branch.repository';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import { CreateTableOrderInput, CreateTakeoutOrderInput, AddItemsToOrderInput, UpdateOrderItemInput, CloseOrderInput } from '../validators/order.validator';
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
    const total = input.items.reduce((s, i) => s + Number(i.subtotal), 0);
    const order = await prisma.order.create({
      data: {
        branchId: input.branchId,
        userId,
        customerName: input.customerName,
        notes: input.notes,
        status: 'OPEN',
        total,
      },
    });
    // createManyAndReturn preserva el orden de entrada (clave para mapear combos)
    const orderItems = await prisma.orderItem.createManyAndReturn({
      data: input.items.map(i => ({
        orderId: order.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
        sentToKitchen: false,
      })),
    });

    // Create OrderItemCombo records
    await createOrderItemCombos(order.id, input.items, orderItems);

    // Enviar a cocina productos que requieren preparación
    await sendToKitchen(order.id, input.items, orderItems);

    return orderRepository.findById(order.id);
  },

  create: async (input: CreateTableOrderInput, userId: string) => {
    const table = await tableRepository.findById(input.tableId);
    if (!table) throw new AppError('Mesa no encontrada', 404);
    if (table.status !== 'FREE') throw new AppError('La mesa no está disponible');

    // Crear la orden
    const { order, items: orderItems } = await orderRepository.create({
      branchId: input.branchId,
      tableId: input.tableId,
      userId,
      customerName: input.customerName,
      notes: input.notes,
      items: input.items,
    });

    // Create OrderItemCombo records
    await createOrderItemCombos(order.id, input.items, orderItems);

    // Marcar mesa como ocupada
    await tableRepository.updateStatus(input.tableId, 'OCCUPIED');

    // Enviar a cocina los productos que requieren preparación
    await sendToKitchen(order.id, input.items, orderItems);

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
    await createOrderItemCombos(orderId, input.items, createdItems);

    // Enviar a cocina solo los productos que requieren preparación
    await sendToKitchen(orderId, input.items, createdItems);

    return orderRepository.findById(orderId);
  },

  /**
   * Marca un envío de cocina como listo.
   */
  markKitchenReady: async (sendId: string) => {
    return orderRepository.markKitchenSendReady(sendId);
  },

  /**
   * Edita un item de la orden (cantidad y/o selecciones de combo).
   * Recalcula el total y sincroniza los envíos PENDING de cocina.
   */
  updateItem: async (orderId: string, itemId: string, input: UpdateOrderItemInput) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError('Pedido no encontrado', 404);
    if (order.status !== 'OPEN') throw new AppError('El pedido ya está cerrado');
    // Resolver el OrderItem: se acepta el id del OrderItem o de un KitchenSendItem vinculado
    let item = order.items.find(i => i.id === itemId) ?? null;
    if (!item) {
      const sendItem = (order.kitchenSends ?? []).flatMap(s => s.items).find(ki => ki.id === itemId);
      if (sendItem?.orderItemId) item = order.items.find(i => i.id === sendItem.orderItemId) ?? null;
    }
    if (!item) throw new AppError('Producto no encontrado', 404);

    const quantity = input.quantity ?? item.quantity;
    const newSubtotal = Number(item.unitPrice) * quantity;

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { quantity, subtotal: newSubtotal },
      });

      if (input.comboSelections) {
        await tx.orderItemCombo.deleteMany({ where: { orderItemId: item.id } });
        for (const sel of input.comboSelections) {
          await tx.orderItemCombo.create({
            data: {
              orderItemId: item.id,
              productId: sel.productId,
              productName: sel.productName,
              quantity,
              lineLabel: sel.lineLabel || null,
            },
          });
        }
      } else if (input.quantity && input.quantity !== item.quantity) {
        // Si solo cambió la cantidad, actualizar las cantidades del desglose
        await tx.orderItemCombo.updateMany({
          where: { orderItemId: item.id },
          data: { quantity },
        });
      }

      // Recalcular total de la orden
      const allItems = await tx.orderItem.findMany({ where: { orderId }, select: { subtotal: true } });
      const total = allItems.reduce((s, i) => s + Number(i.subtotal), 0);
      await tx.order.update({ where: { id: orderId }, data: { total } });
    });

    // Sincronizar cocina (envíos PENDING) fuera de la transacción principal
    await orderRepository.syncKitchenItem(orderId, item.id, {
      quantity,
      ...(input.comboSelections ? { comboSelections: input.comboSelections } : {}),
    });

    return orderRepository.findById(orderId);
  },

  /**
   * Elimina un item de la orden y lo quita de los envíos PENDING de cocina.
   */
  removeItem: async (orderId: string, itemId: string) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError('Pedido no encontrado', 404);
    if (order.status !== 'OPEN') throw new AppError('El pedido ya está cerrado');
    // Resolver el OrderItem: se acepta el id del OrderItem o de un KitchenSendItem vinculado
    let item = order.items.find(i => i.id === itemId) ?? null;
    let sendItemId: string | null = null;
    if (!item) {
      const sendItem = (order.kitchenSends ?? []).flatMap(s => s.items).find(ki => ki.id === itemId);
      if (sendItem) {
        sendItemId = sendItem.id;
        if (sendItem.orderItemId) item = order.items.find(i => i.id === sendItem.orderItemId) ?? null;
      }
    }
    if (!item && !sendItemId) throw new AppError('Producto no encontrado', 404);

    if (item) {
      await prisma.$transaction(async (tx) => {
        await tx.orderItem.delete({ where: { id: item.id } });
        const allItems = await tx.orderItem.findMany({ where: { orderId }, select: { subtotal: true } });
        const total = allItems.reduce((s, i) => s + Number(i.subtotal), 0);
        await tx.order.update({ where: { id: orderId }, data: { total } });
      });

      // Quitar del envío pendiente de cocina (si quedó vacío se elimina)
      await orderRepository.removeKitchenItem(orderId, item.id);
    } else if (sendItemId) {
      // El item de la orden ya no existe (se eliminó antes): solo quitar la
      // tarjeta vieja de cocina para que no se confunda al personal
      await orderRepository.removeKitchenSendItemById(sendItemId);
    }

    return orderRepository.findById(orderId);
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
 * Si se pasan los orderItems recién creados (createManyAndReturn preserva el
 * orden de entrada), mapea por índice — así cada instancia de un mismo combo
 * recibe SUS propias selecciones.
 */
async function createOrderItemCombos(orderId: string, items: Array<{ productId: string; quantity: number; comboSelections?: Array<{ productId: string; productName: string; lineLabel?: string }> }>, createdItems?: Array<{ id: string; productId: string }>) {
  const itemsWithCombos = items.filter(i => i.comboSelections && i.comboSelections.length > 0);
  if (itemsWithCombos.length === 0) return;

  // Fallback: si no se pasaron los items creados, buscar los de la orden
  const orderItems = createdItems ?? await prisma.orderItem.findMany({
    where: { orderId },
    orderBy: { id: 'asc' },
  });

  const used = new Set<string>();
  for (let idx = 0; idx < items.length; idx++) {
    const inputItem = items[idx];
    if (!inputItem.comboSelections || inputItem.comboSelections.length === 0) continue;
    // Con createdItems el índice es directo; en fallback, primer no usado
    const orderItem = createdItems
      ? orderItems[idx]
      : orderItems.find(oi => oi.productId === inputItem.productId && !used.has(oi.id));
    if (!orderItem || used.has(orderItem.id)) continue;
    used.add(orderItem.id);

    for (const sel of inputItem.comboSelections) {
      await prisma.orderItemCombo.create({
        data: {
          orderItemId: orderItem.id,
          productId: sel.productId,
          productName: sel.productName,
          // Si el desayuno/combo va xN, cada selección también va xN
          quantity: inputItem.quantity,
          lineLabel: sel.lineLabel || null,
        },
      });
    }
  }
}

/**
 * Envía a cocina los productos que requieren preparación.
 * Si la orden ya tiene un envío PENDING (aún no marcado como listo), los items
 * nuevos se agregan a ESE envío para no confundir a la cocina con tarjetas
 * duplicadas. Solo si el envío anterior fue marcado como listo se crea uno nuevo.
 */
async function sendToKitchen(orderId: string, items: Array<{ productId: string; quantity: number; comboSelections?: Array<{ productId: string; productName: string; lineLabel?: string }> }>, createdItems?: Array<{ id: string; productId: string }>) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map(i => i.productId) } },
    select: { id: true, requiresPreparation: true },
  });

  const prepMap = new Map(products.map(p => [p.id, p.requiresPreparation]));
  // Cada item lleva sus propias selecciones de combo, así la cocina las
  // renderiza anidadas debajo de su combo padre.
  const kitchenItems: Array<{ productId: string; quantity: number; orderItemId?: string; comboSelections?: Array<{ productId: string; productName: string; quantity?: number; lineLabel?: string | null }> }> = [];
  items.forEach((i, idx) => {
    if (prepMap.get(i.productId) === false) return;
    kitchenItems.push({
      productId: i.productId,
      quantity: i.quantity,
      // Vincular con el OrderItem para poder sincronizar ediciones
      ...(createdItems?.[idx]?.id ? { orderItemId: createdItems[idx].id } : {}),
      ...(i.comboSelections && i.comboSelections.length > 0
        ? { comboSelections: i.comboSelections.map(sel => ({ ...sel, quantity: i.quantity })) }
        : {}),
    });
  });

  if (kitchenItems.length === 0) return;

  // Merge: si hay un envío pendiente, agregar ahí; si no, crear uno nuevo
  const pending = await orderRepository.findPendingKitchenSend(orderId);
  if (pending) {
    await orderRepository.appendToKitchenSend(pending.id, kitchenItems);
  } else {
    await orderRepository.createKitchenSend(orderId, kitchenItems);
  }
}
