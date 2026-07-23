import { prisma } from '../config/database';

export const recipeRepository = {
  findByProduct: (productId: string) =>
    prisma.recipe.findMany({
      where: { productId },
      include: { ingredient: true },
    }),

  bulkCreate: (items: { productId: string; ingredientId: string; quantity: number }[]) =>
    prisma.$transaction(
      items.map((item) =>
        prisma.recipe.upsert({
          where: {
            productId_ingredientId: {
              productId: item.productId,
              ingredientId: item.ingredientId,
            },
          },
          create: item,
          update: { quantity: item.quantity },
        })
      )
    ),

  delete: (productId: string, ingredientId: string) =>
    prisma.recipe.delete({
      where: {
        productId_ingredientId: { productId, ingredientId },
      },
    }),

  deleteByProduct: (productId: string) =>
    prisma.recipe.deleteMany({ where: { productId } }),
};
