import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(2, 'Nombre del local requerido'),
  address: z.string().min(5, 'Dirección requerida'),
  phone: z.string().optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(5).optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

export const updateFiscalConfigSchema = z.object({
  ruc: z.string().min(13).max(13).optional().or(z.literal('')),
  businessName: z.string().optional(),
  tradeName: z.string().optional(),
  receiptAuthorization: z.string().optional(),
  rimpeLegend: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  establishmentCode: z.string().optional().or(z.literal('')),
  emissionPointCode: z.string().optional().or(z.literal('')),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type UpdateFiscalConfigInput = z.infer<typeof updateFiscalConfigSchema>;
