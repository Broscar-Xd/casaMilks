import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export const productRepository = {
  listByBranch: (branchId: string, categoryId?: string) =>
    prisma.product.findMany({
      where: {
        branchId,
        active: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),

  listAll: (branchId?: string) =>
    prisma.product.findMany({
      where: branchId ? { branchId } : undefined,
      include: { category: true },
      orderBy: { name: 'asc' },
    }),

  findById: (id: string) =>
    prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        recipes: { include: { ingredient: true } },
      },
    }),

  create: (data: Prisma.ProductCreateInput) =>
    prisma.product.create({
      data,
      include: { category: true },
    }),

  update: (id: string, data: Prisma.ProductUpdateInput) =>
    prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    }),
};
