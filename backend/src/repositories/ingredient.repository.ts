import { prisma } from '../config/database';

export const ingredientRepository = {
  list: () =>
    prisma.ingredient.findMany({ orderBy: { name: 'asc' } }),

  findById: (id: string) =>
    prisma.ingredient.findUnique({ where: { id } }),

  create: (data: { name: string; unit?: string; minStock?: number }) =>
    prisma.ingredient.create({ data }),

  update: (id: string, data: { name?: string; unit?: string; minStock?: number }) =>
    prisma.ingredient.update({ where: { id }, data }),
};
