import { z } from 'zod';

export const adjustInventorySchema = z.object({
  ingredientId: z.string().uuid('Insumo inválido'),
  branchId: z.string().uuid('Local inválido'),
  quantity: z.number(),
  notes: z.string().optional(),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
