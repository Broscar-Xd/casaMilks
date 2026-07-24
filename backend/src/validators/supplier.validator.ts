import { z } from 'zod';

export const createSupplierPaymentSchema = z.object({
  supplierName: z.string().min(1, 'Nombre del proveedor requerido'),
  cashAmount: z.number().min(0).optional().default(0),
  transferAmount: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
});

export const listSupplierPaymentsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  supplierName: z.string().optional(),
  branchId: z.string(),
});

export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;
