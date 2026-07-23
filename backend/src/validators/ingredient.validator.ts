import { z } from 'zod';

export const createIngredientSchema = z.object({
  name: z.string().min(2, 'Nombre del insumo requerido'),
  unit: z.string().optional(),
  minStock: z.number().min(0).optional(),
});

export const updateIngredientSchema = z.object({
  name: z.string().min(2).optional(),
  unit: z.string().optional(),
  minStock: z.number().min(0).optional(),
});

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;
