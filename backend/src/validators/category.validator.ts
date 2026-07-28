import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Nombre de categoría requerido'),
  description: z.string().optional(),
  isCombo: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  isCombo: z.boolean().optional(),
});

export const comboLineSchema = z.object({
  label: z.string().min(1, 'Label requerido'),
  sourceCategoryId: z.string().uuid(),
  minSelect: z.number().int().min(0).default(1),
  maxSelect: z.number().int().min(1).default(1),
  required: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const saveComboLinesSchema = z.object({
  lines: z.array(comboLineSchema),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type SaveComboLinesInput = z.infer<typeof saveComboLinesSchema>;
