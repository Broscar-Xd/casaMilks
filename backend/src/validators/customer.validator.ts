import { z } from 'zod';

export const upsertCustomerSchema = z.object({
  branchId: z.string().uuid('Local inválido'),
  docId: z.string().min(10, 'Cédula/RUC requerido').max(13),
  name: z.string().min(1, 'Nombre requerido'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
});

export type UpsertCustomerInput = z.infer<typeof upsertCustomerSchema>;
