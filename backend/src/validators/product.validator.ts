import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Nombre del producto requerido'),
  description: z.string().optional(),
  price: z.number().positive('El precio debe ser mayor a 0'),
  categoryId: z.string().uuid('Categoría inválida'),
  branchId: z.string().uuid('Local inválido'),
  image: z.string().optional(),
  requiresPreparation: z.boolean().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  image: z.string().optional(),
  active: z.boolean().optional(),
  requiresPreparation: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
