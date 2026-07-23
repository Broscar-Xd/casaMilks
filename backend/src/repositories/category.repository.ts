import { prisma } from '../config/database';

export const categoryRepository = {
  list: () =>
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),

  listAll: () =>
    prisma.category.findMany({ orderBy: { name: 'asc' } }),

  findById: (id: string) =>
    prisma.category.findUnique({ where: { id } }),

  create: (data: { name: string; description?: string }) =>
    prisma.category.create({ data }),

  update: (id: string, data: { name?: string; description?: string; active?: boolean }) =>
    prisma.category.update({ where: { id }, data }),
};
