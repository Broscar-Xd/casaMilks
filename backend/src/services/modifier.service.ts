import { modifierRepository } from '../repositories/modifier.repository';
import { productRepository } from '../repositories/product.repository';
import { AppError } from '../middlewares/errorHandler';
import { BulkModifiersInput } from '../validators/modifier.validator';

export const modifierService = {
  findByProduct: async (productId: string) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError('Producto no encontrado', 404);
    return modifierRepository.findByProduct(productId);
  },

  bulkReplace: async (input: BulkModifiersInput) => {
    const product = await productRepository.findById(input.productId);
    if (!product) throw new AppError('Producto no encontrado', 404);

    for (const group of input.groups) {
      if (group.maxSelect < group.minSelect) {
        throw new AppError(`En el grupo "${group.name}", el máximo no puede ser menor al mínimo`);
      }
      if (group.required && group.minSelect < 1) {
        // Un grupo obligatorio implica al menos 1 selección
        group.minSelect = 1;
      }
    }

    return modifierRepository.bulkReplace(input);
  },
};
