import { orderRepository } from '../repositories/order.repository';
import { tableRepository } from '../repositories/table.repository';
import { inventoryRepository } from '../repositories/inventory.repository';
import { branchRepository } from '../repositories/branch.repository';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import { CreateTableOrderInput, CreateTakeoutOrderInput, AddItemsToOrderInput, UpdateOrderItemInput, CloseOrderInput } from '../validators/order.validator';
import { startOfEcuadorDay, endOfEcuadorDay } from '../utils/date';

/** Opciones de transacción para Prisma: eleva timeout a 20s y maxWait a 5s para evitar abortos por latencia de red */
const TX_OPTIONS = { maxWait: 5000, timeout: 20000 } as const;

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

  listByBranch: (branchId: string, dateFrom?: string, dateTo?: string, takeoutOpen?: boolean) => {
    // dateFrom → inicio del día (00:00:00.000) y dateTo → fin (23:59:59.999),
    // ambos en hora de Ecuador (UTC-5). Sin esto, filtrar por un día
    // excluye todo lo posterior a las 19:00 (server en UTC).
    const parsedDateFrom = dateFrom ? startOfEcuadorDay(dateFrom) : undefined;
    const parsedDateTo = dateTo ? endOfEcuadorDay(dateTo) : undefined;
    return orderRepository.listByBranch(branchId, parsedDateFrom, parsedDateTo, takeoutOpen);
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

    // Crear combos y enviar a cocina en paralelo
    await Promise.all([
      createOrderItemCombos(order.id, input.items, orderItems),
      sendToKitchen(order.id, input.items, orderItems),
    ]);

    return orderRepository.findById(order.id);
  },

  create: async (input: CreateTableOrderInput, userId: string) => {
    // Crear la orden (valida atómicamente la mesa, previene órdenes dobles y marca OCCUPIED en la misma transacción)
    const { order, items: orderItems } = await orderRepository.create({
      branchId: input.branchId,
      tableId: input.tableId,
      userId,
      customerName: input.customerName,
      notes: input.notes,
      items: input.items,
    });

    // Crear combos y enviar a cocina en paralelo
    await Promise.all([
      createOrderItemCombos(order.id, input.items, orderItems),
      sendToKitchen(order.id, input.items, orderItems),
    ]);

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

    // Crear combos y enviar a cocina en paralelo
    await Promise.all([
      createOrderItemCombos(orderId, input.items, createdItems),
      sendToKitchen(orderId, input.items, createdItems),
    ]);

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
      const sendItem = await prisma.kitchenSendItem.findFirst({
        where: { id: itemId, send: { orderId } },
        select: { orderItemId: true },
      });
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
        if (input.comboSelections.length > 0) {
          await tx.orderItemCombo.createMany({
            data: input.comboSelections.map(sel => ({
              orderItemId: item.id,
              productId: sel.productId,
              productName: sel.productName,
              quantity,
              lineLabel: sel.lineLabel || null,
            })),
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
    }, TX_OPTIONS);

    // Sincronizar cocina (envíos PENDING) fuera de la transacción principal
    await orderRepository.syncKitchenItem(orderId, item.id, {
      quantity,
      ...(input.comboSelections ? { comboSelections: input.comboSelections } : {}),
    });

    return orderRepository.findById(orderId);
  },

  /**
   * Elimina un item de la orden y lo quita de los envíos PENDING de cocina.
   * Ejecutado en una única transacción atómica y rápida.
   */
  removeItem: async (orderId: string, itemId: string) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, tableId: true },
    });
    if (!order) throw new AppError('Pedido no encontrado', 404);
    if (order.status !== 'OPEN') throw new AppError('El pedido ya está cerrado');

    // Resolver si el itemId es de OrderItem o de KitchenSendItem
    let targetOrderItemId = itemId;
    const directItem = await prisma.orderItem.findFirst({ where: { id: itemId, orderId }, select: { id: true } });
    if (!directItem) {
      const sendItem = await prisma.kitchenSendItem.findFirst({
        where: { id: itemId, send: { orderId } },
        select: { id: true, orderItemId: true },
      });
      if (sendItem?.orderItemId) {
        targetOrderItemId = sendItem.orderItemId;
      } else if (sendItem) {
        await orderRepository.removeKitchenSendItemById(sendItem.id);
        return orderRepository.findById(orderId);
      } else {
        throw new AppError('Producto no encontrado', 404);
      }
    }

    let orderDeleted = false;
    await prisma.$transaction(async (tx) => {
      // 1. Quitar item de envíos de cocina pendientes vinculados
      const kiItems = await tx.kitchenSendItem.findMany({
        where: { orderItemId: targetOrderItemId, send: { orderId, status: 'PENDING' } },
        select: { id: true, sendId: true },
      });
      if (kiItems.length > 0) {
        const kiIds = kiItems.map(i => i.id);
        const sendIds = [...new Set(kiItems.map(i => i.sendId))];
        await tx.kitchenSendCombo.deleteMany({ where: { kitchenSendItemId: { in: kiIds } } });
        await tx.kitchenSendItem.deleteMany({ where: { id: { in: kiIds } } });
        await tx.kitchenSend.deleteMany({ where: { id: { in: sendIds }, items: { none: {} } } });
      }

      // 2. Eliminar el OrderItem
      await tx.orderItem.deleteMany({ where: { id: targetOrderItemId, orderId } });

      // 3. Revisar items restantes
      const remainingItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { subtotal: true },
      });

      if (remainingItems.length === 0) {
        const receipt = await tx.electronicReceipt.findUnique({ where: { orderId } });
        if (!receipt) {
          await tx.kitchenSend.deleteMany({ where: { orderId } });
          await tx.order.delete({ where: { id: orderId } });
          orderDeleted = true;
          if (order.tableId) {
            await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
          }
        }
      } else {
        const total = remainingItems.reduce((s, i) => s + Number(i.subtotal), 0);
        await tx.order.update({ where: { id: orderId }, data: { total } });
      }
    }, TX_OPTIONS);

    if (orderDeleted) return null;
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
      // Registrar pagos en lote
      const paymentPromise = tx.payment.createMany({
        data: input.payments.map((p) => ({
          orderId,
          method: p.method,
          amount: p.amount,
          referenceNumber: p.referenceNumber,
          cashReceived: p.cashReceived,
          cashChange: p.cashChange,
        })),
      });

      // Preparar actualización de orden con datos de factura si aplica
      const updateData: any = { status: 'CLOSED' };
      if (input.invoice) {
        updateData.invoiceName = input.invoice.invoiceName;
        updateData.invoiceDocId = input.invoice.invoiceDocId;
        updateData.invoiceEmail = input.invoice.invoiceEmail || null;
        updateData.invoicePhone = input.invoice.invoicePhone || null;
        updateData.invoiceAddress = input.invoice.invoiceAddress || 'Latacunga';
      }
      const orderPromise = tx.order.update({ where: { id: orderId }, data: updateData });

      // Preparar emisión de nota de venta
      const receiptPromise = tx.electronicReceipt.create({
        data: {
          orderId, branchId: order.branchId, sequential: seq,
          type: 'NOTA_VENTA',
          authorization: `CASAMILKS-${year}-${String(seq).padStart(9, '0')}`,
          status: 'EMITTED',
        },
      });

      // Ejecutar escrituras principales en paralelo para reducir saltos de red
      await Promise.all([paymentPromise, orderPromise, receiptPromise]);

      if (order.tableId) {
        // Verificar si quedan otras órdenes abiertas en la misma mesa antes de liberarla
        const remainingOpen = await tx.order.count({
          where: {
            tableId: order.tableId,
            status: 'OPEN',
            id: { not: orderId },
          },
        });
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: remainingOpen === 0 ? 'FREE' : 'OCCUPIED' },
        });
      }
    }, TX_OPTIONS);

    // 2. Descontar inventario en segundo plano de forma agrupada (no bloquea el cobro del POS)
    deductInventory(orderId, order.branchId).catch((err) => {
      console.error(`[deductInventory] Error al descontar inventario para orden ${orderId}:`, err);
    });

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
 * Descuenta del inventario los insumos de las recetas de los productos vendidos.
 * Agrupa los consumos por insumo para realizar un único conjunto de consultas
 * en lote y se ejecuta de forma asíncrona para no demorar la respuesta de cobro en POS.
 */
async function deductInventory(orderId: string, branchId: string) {
  try {
    const items = await prisma.orderItem.findMany({
      where: { orderId },
      include: { product: { include: { recipes: true } } },
    });

    const ingredientDeductions = new Map<string, number>();
    for (const item of items) {
      if (!item.product?.recipes) continue;
      for (const recipe of item.product.recipes) {
        const qty = Number(recipe.quantity) * item.quantity;
        const current = ingredientDeductions.get(recipe.ingredientId) || 0;
        ingredientDeductions.set(recipe.ingredientId, current + qty);
      }
    }

    if (ingredientDeductions.size === 0) return;

    const ingredientIds = Array.from(ingredientDeductions.keys());
    const stockItems = await prisma.inventoryItem.findMany({
      where: { branchId, ingredientId: { in: ingredientIds } },
    });
    const stockMap = new Map(stockItems.map(s => [s.ingredientId, s]));

    const stockUpdates: Promise<any>[] = [];
    const movementsData: Array<{
      ingredientId: string;
      branchId: string;
      type: 'OUT';
      quantity: number;
      reference: string;
      orderId: string;
    }> = [];

    for (const [ingredientId, qty] of ingredientDeductions.entries()) {
      const stock = stockMap.get(ingredientId);
      if (stock) {
        const newQty = Math.max(0, Number(stock.quantity) - qty);
        stockUpdates.push(
          prisma.inventoryItem.update({
            where: { id: stock.id },
            data: { quantity: newQty },
          })
        );
      }
      movementsData.push({
        ingredientId,
        branchId,
        type: 'OUT',
        quantity: qty,
        reference: `Pedido #${orderId.slice(0, 8)}`,
        orderId,
      });
    }

    await Promise.all([
      Promise.all(stockUpdates),
      movementsData.length > 0
        ? prisma.inventoryMovement.createMany({ data: movementsData })
        : Promise.resolve(),
    ]);
  } catch (error) {
    console.error(`[deductInventory] Error al descontar inventario para orden ${orderId}:`, error);
  }
}

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
  const combosToCreate: Array<{
    orderItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    lineLabel: string | null;
  }> = [];

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
      combosToCreate.push({
        orderItemId: orderItem.id,
        productId: sel.productId,
        productName: sel.productName,
        // Si el desayuno/combo va xN, cada selección también va xN
        quantity: inputItem.quantity,
        lineLabel: sel.lineLabel || null,
      });
    }
  }

  if (combosToCreate.length > 0) {
    await prisma.orderItemCombo.createMany({
      data: combosToCreate,
    });
  }
}

/**
 * Envía a cocina los productos que requieren preparación.
 * Si la orden ya tiene un envío PENDING (aún no marcado como listo), los items
 * nuevos se agregan a ESE envío para no confundir a la cocina con tarjetas
 * duplicadas. Solo si el envío anterior fue marcado como listo se crea uno nuevo.
 */
async function sendToKitchen(orderId: string, items: Array<{ productId: string; quantity: number; comboSelections?: Array<{ productId: string; productName: string; lineLabel?: string }> }>, createdItems?: Array<{ id: string; productId: string }>) {
  // Consultar en paralelo los productos y la existencia de envíos pendientes
  const [products, pending] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: items.map(i => i.productId) } },
      select: { id: true, requiresPreparation: true },
    }),
    orderRepository.findPendingKitchenSend(orderId),
  ]);

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
  if (pending) {
    await orderRepository.appendToKitchenSend(pending.id, kitchenItems);
  } else {
    await orderRepository.createKitchenSend(orderId, kitchenItems);
  }
}
