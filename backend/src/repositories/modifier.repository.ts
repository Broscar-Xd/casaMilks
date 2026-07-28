import { prisma } from '../config/database';
import { BulkModifiersInput } from '../validators/modifier.validator';

export const modifierRepository = {
  findByProduct: (productId: string) =>
    prisma.modifierGroup.findMany({
      where: { productId, active: true },
      include: {
        options: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    }),

  /**
   * Reemplaza todos los grupos de opciones de un producto en una transacción:
   * borra los existentes y recrea los enviados. Simple y consistente.
   */
  bulkReplace: (input: BulkModifiersInput) =>
    prisma.$transaction(async (tx) => {
      await tx.modifierGroup.deleteMany({ where: { productId: input.productId } });

      for (const [gIdx, group] of input.groups.entries()) {
        await tx.modifierGroup.create({
          data: {
            productId: input.productId,
            name: group.name,
            required: group.required,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: gIdx,
            options: {
              create: group.options.map((o, oIdx) => ({
                name: o.name,
                priceDelta: o.priceDelta,
                sortOrder: oIdx,
              })),
            },
          },
        });
      }

      return tx.modifierGroup.findMany({
        where: { productId: input.productId },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      });
    }),
};
