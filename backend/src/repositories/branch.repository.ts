import { prisma } from '../config/database';

export const branchRepository = {
  list: () =>
    prisma.branch.findMany({
      include: { fiscalConfig: true },
      orderBy: { name: 'asc' },
    }),

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

  /**
   * Siguiente secuencial para un tipo de comprobante.
   * ⚠️ ATOMICO: usa increment:1 (como el SRI). El patrón anterior
   * (leer lastUsed → +1 → update) con dos peticiones concurrentes
   * devolvía el MISMO secuencial → "Unique constraint failed".
   */
  getNextSequential: async (branchId: string, year: number, type: string = 'NOTA_VENTA', tx?: any) => {
    const client = tx || prisma;
    const seq = await client.receiptSequence.upsert({
      where: { branchId_year_type: { branchId, year, type } },
      create: { branchId, year, type, lastUsed: 1 },
      update: { lastUsed: { increment: 1 } },
    });
    return seq.lastUsed;
  },
};
