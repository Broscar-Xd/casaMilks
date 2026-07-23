import { recipeRepository } from '../repositories/recipe.repository';
import { productRepository } from '../repositories/product.repository';
import { AppError } from '../middlewares/errorHandler';
import { BulkCreateRecipeInput } from '../validators/recipe.validator';

export const recipeService = {
  findByProduct: async (productId: string) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError('Producto no encontrado', 404);
    return recipeRepository.findByProduct(productId);
  },

  bulkCreate: async (input: BulkCreateRecipeInput) => {
    const product = await productRepository.findById(input.productId);
    if (!product) throw new AppError('Producto no encontrado', 404);

    const items = input.items.map((item) => ({
      productId: input.productId,
      ingredientId: item.ingredientId,
      quantity: item.quantity,
    }));

    return recipeRepository.bulkCreate(items);
  },

  delete: async (productId: string, ingredientId: string) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError('Producto no encontrado', 404);
    return recipeRepository.delete(productId, ingredientId);
  },

  deleteByProduct: async (productId: string) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError('Producto no encontrado', 404);
    return recipeRepository.deleteByProduct(productId);
  },
};
