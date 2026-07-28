import { prisma } from '../config/database';

export const categoryRepository = {
  list: () =>
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),

  listAll: () =>
    prisma.category.findMany({
      orderBy: { name: 'asc' },
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

  create: (data: { name: string; description?: string; isCombo?: boolean }) =>
    prisma.category.create({ data }),

  update: (id: string, data: { name?: string; description?: string; active?: boolean; isCombo?: boolean }) =>
    prisma.category.update({ where: { id }, data }),

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
