import { z } from 'zod';

export const createRecipeSchema = z.object({
  productId: z.string().uuid('Producto inválido'),
  ingredientId: z.string().uuid('Insumo inválido'),
  quantity: z.number().positive('Cantidad debe ser mayor a 0'),
});

export const bulkCreateRecipeSchema = z.object({
  productId: z.string().uuid(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().positive(),
    })
  ).min(1, 'Debe tener al menos un insumo'),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type BulkCreateRecipeInput = z.infer<typeof bulkCreateRecipeSchema>;
