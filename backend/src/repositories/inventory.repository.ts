import { prisma } from '../config/database';

export const inventoryRepository = {
  getByBranch: (branchId: string) =>
    prisma.inventoryItem.findMany({
      where: { branchId },
      include: { ingredient: true },
      orderBy: { ingredient: { name: 'asc' } },
    }),

  getByBranchAndIngredient: (branchId: string, ingredientId: string) =>
    prisma.inventoryItem.findUnique({
      where: { ingredientId_branchId: { ingredientId, branchId } },
    }),

  upsert: (branchId: string, ingredientId: string, quantity: number) =>
    prisma.inventoryItem.upsert({
      where: { ingredientId_branchId: { ingredientId, branchId } },
      create: { branchId, ingredientId, quantity },
      update: { quantity },
    }),

  createMovement: (data: {
    ingredientId: string;
    branchId: string;
    type: string;
    quantity: number;
    reference?: string | null;
    orderId?: string | null;
    notes?: string | null;
  }) =>
    prisma.inventoryMovement.create({
      data: {
        ingredientId: data.ingredientId,
        branchId: data.branchId,
        type: data.type as any,
        quantity: data.quantity,
        reference: data.reference,
        orderId: data.orderId,
        notes: data.notes,
      },
    }),

  getStockAlerts: async (branchId: string) => {
    const items = await prisma.inventoryItem.findMany({
      where: { branchId },
      include: { ingredient: true },
    });
    return items.filter((item) => Number(item.quantity) <= Number(item.ingredient.minStock));
  },

  getMovements: (branchId: string, ingredientId?: string) =>
    prisma.inventoryMovement.findMany({
      where: {
        branchId,
        ...(ingredientId ? { ingredientId } : {}),
      },
      include: { ingredient: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
};
