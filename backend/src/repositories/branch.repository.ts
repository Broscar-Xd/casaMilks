import { prisma } from '../config/database';

export const branchRepository = {
  list: () =>
    prisma.branch.findMany({ orderBy: { name: 'asc' } }),

  findById: (id: string) =>
    prisma.branch.findUnique({
      where: { id },
      include: { fiscalConfig: true },
    }),

  create: (data: { name: string; address: string; phone?: string }) =>
    prisma.branch.create({ data }),

  update: (id: string, data: { name?: string; address?: string; phone?: string; active?: boolean }) =>
    prisma.branch.update({ where: { id }, data }),

  upsertFiscalConfig: (branchId: string, data: any) =>
    prisma.branchFiscalConfig.upsert({
      where: { branchId },
      create: { branchId, ...data },
      update: data,
    }),

  getNextSequential: async (branchId: string, year: number, type: string = 'NOTA_VENTA', tx?: any) => {
    const client = tx || prisma;
    const seq = await client.receiptSequence.upsert({
      where: { branchId_year_type: { branchId, year, type } },
      create: { branchId, year, type, lastUsed: 0 },
      update: {},
    });
    const next = seq.lastUsed + 1;
    await client.receiptSequence.update({
      where: { id: seq.id },
      data: { lastUsed: next },
    });
    return next;
  },
};
