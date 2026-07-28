import { z } from 'zod';

const modifierOptionSchema = z.object({
  name: z.string().min(1, 'Nombre de la opción requerido'),
  priceDelta: z.number().min(0, 'El precio no puede ser negativo').default(0),
  sortOrder: z.number().int().default(0),
});

const modifierGroupSchema = z.object({
  name: z.string().min(1, 'Nombre del grupo requerido'),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(modifierOptionSchema).min(1, 'Cada grupo necesita al menos una opción'),
});

/**
 * Reemplaza por completo los grupos de opciones de un producto.
 * Se envía la lista completa; lo que no venga se elimina.
 */
export const bulkModifiersSchema = z.object({
  productId: z.string().uuid('Producto inválido'),
  groups: z.array(modifierGroupSchema),
});

export type BulkModifiersInput = z.infer<typeof bulkModifiersSchema>;
