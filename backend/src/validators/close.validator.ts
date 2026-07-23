import { z } from 'zod';

export const closeDaySchema = z.object({
  branchId: z.string().uuid('Local inválido'),
  closeDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CloseDayInput = z.infer<typeof closeDaySchema>;
