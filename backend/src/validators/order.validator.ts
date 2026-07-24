import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.string().uuid('Producto inválido'),
  quantity: z.number().int().positive('Cantidad debe ser al menos 1'),
  unitPrice: z.number().positive(),
  subtotal: z.number().positive(),
});

export const createTableOrderSchema = z.object({
  tableId: z.string().uuid('Mesa inválida'),
  branchId: z.string().uuid('Local inválido'),
  customerName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'Debe tener al menos un producto'),
});

export const createTakeoutOrderSchema = z.object({
  customerName: z.string().min(1, 'Nombre del cliente requerido'),
  branchId: z.string().uuid('Local inválido'),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'Debe tener al menos un producto'),
});

export const addItemsToOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Debe tener al menos un producto'),
});

export const closeOrderSchema = z.object({
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'DEUNA', 'PANAPAY']),
    amount: z.number().positive(),
    referenceNumber: z.string().optional().nullable(),
    cashReceived: z.number().positive().optional().nullable(),
    cashChange: z.number().min(0).optional().nullable(),
  })).min(1, 'Debe tener al menos una forma de pago'),
});

export type CreateTableOrderInput = z.infer<typeof createTableOrderSchema>;
export type CreateTakeoutOrderInput = z.infer<typeof createTakeoutOrderSchema>;
export type AddItemsToOrderInput = z.infer<typeof addItemsToOrderSchema>;
export type CloseOrderInput = z.infer<typeof closeOrderSchema>;
