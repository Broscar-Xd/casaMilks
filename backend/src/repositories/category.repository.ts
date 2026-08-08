import { prisma } from '../config/database';

export const categoryRepository = {
  list: () =>
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),

  listAll: () =>
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),

  findById: (id: string) =>
    prisma.category.findUnique({
      where: { id },
      include: {
        comboLines: {
          include: {
            sourceCategory: true,
            comboLineProducts: {
              include: { product: { select: { id: true, name: true, price: true, categoryId: true, category: { select: { name: true } } } } },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),

  create: (data: { name: string; description?: string; isCombo?: boolean; sortOrder?: number }) =>
    prisma.category.create({ data }),

  update: (id: string, data: { name?: string; description?: string; active?: boolean; isCombo?: boolean; sortOrder?: number }) =>
    prisma.category.update({ where: { id }, data }),

  /** Asigna sortOrder 1..N a todas las categorías (según el orden actual: sortOrder asc, luego nombre). */
  async reorderAll(): Promise<number> {
    const cats = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    // Preservar el orden: agrupar por sortOrder actual y ordenar cada grupo por nombre
    const ordered = [...cats].sort((a, b) => {
      const soA = a.sortOrder || 0;
      const soB = b.sortOrder || 0;
      if (soA !== soB) return soA - soB;
      return a.name.localeCompare(b.name);
    });
    let count = 0;
    for (let i = 0; i < ordered.length; i++) {
      const newOrder = i + 1;
      if ((ordered[i].sortOrder || 0) !== newOrder) {
        await prisma.category.update({ where: { id: ordered[i].id }, data: { sortOrder: newOrder } });
        count++;
      }
    }
    return count;
  },

  // Combo lines
  getComboLines: (categoryId: string) =>
    prisma.comboLine.findMany({
      where: { categoryId },
      include: {
        sourceCategory: true,
        comboLineProducts: {
          include: { product: { select: { id: true, name: true, price: true, categoryId: true, category: { select: { name: true } } } } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),

  deleteComboLines: (categoryId: string) =>
    prisma.comboLine.deleteMany({ where: { categoryId } }),

  createComboLine: (data: {
    categoryId: string;
    label: string;
    sourceCategoryId?: string | null;
    minSelect: number;
    maxSelect: number;
    required: boolean;
    sortOrder: number;
    productIds: string[];
  }) =>
    prisma.comboLine.create({
      data: {
        categoryId: data.categoryId,
        label: data.label,
        sourceCategoryId: data.sourceCategoryId ?? null,
        minSelect: data.minSelect,
        maxSelect: data.maxSelect,
        required: data.required,
        sortOrder: data.sortOrder,
        comboLineProducts: {
          create: data.productIds.map(productId => ({ productId })),
        },
      },
    }),
};
