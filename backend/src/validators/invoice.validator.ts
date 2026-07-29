import { z } from 'zod';

export const invoiceSchema = z.object({
  invoiceName: z.string().min(1, 'Nombre requerido'),
  invoiceDocId: z.string().min(1, 'Cédula/RUC requerido'),
  invoiceEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  invoicePhone: z.string().optional().or(z.literal('')),
  invoiceAddress: z.string().default('Latacunga'),
});
