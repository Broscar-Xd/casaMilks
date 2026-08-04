import { prisma } from '../config/database';
import { UpsertCustomerInput } from '../validators/customer.validator';

export const customerRepository = {
  /** Busca clientes del local por documento o nombre (sugerencias). */
  list: (branchId: string, search?: string) =>
    prisma.customer.findMany({
      where: {
        branchId,
        ...(search
          ? {
              OR: [
                { docId: { contains: search } },
                { name: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),

  /** Guarda o actualiza un cliente (único por docId en el local). */
  upsert: (input: UpsertCustomerInput) =>
    prisma.customer.upsert({
      where: { branchId_docId: { branchId: input.branchId, docId: input.docId } },
      create: {
        branchId: input.branchId,
        docId: input.docId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
      },
      update: {
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
      },
    }),
};
