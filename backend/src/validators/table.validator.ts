import { z } from 'zod';

export const createTableSchema = z.object({
  name: z.string().min(1, 'Nombre de mesa requerido'),
  branchId: z.string().uuid('Local inválido'),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
