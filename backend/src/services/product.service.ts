import { productRepository } from '../repositories/product.repository';
import { AppError } from '../middlewares/errorHandler';
import { CreateProductInput, UpdateProductInput } from '../validators/product.validator';

export const productService = {
  listByBranch: (branchId: string, categoryId?: string) =>
    productRepository.listByBranch(branchId, categoryId),

  listAll: (branchId?: string) => productRepository.listAll(branchId),

  getById: async (id: string) => {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError('Producto no encontrado', 404);
    return product;
  },

  create: (input: CreateProductInput) =>
    productRepository.create({
      name: input.name,
      description: input.description,
      price: input.price,
      image: input.image,
      requiresPreparation: input.requiresPreparation,
      category: { connect: { id: input.categoryId } },
      branch: { connect: { id: input.branchId } },
    }),

  update: (id: string, input: UpdateProductInput) => {
    const data: any = { ...input };
    if (input.categoryId) {
      data.category = { connect: { id: input.categoryId } };
      delete data.categoryId;
    }
    if (input.branchId) {
      data.branch = { connect: { id: input.branchId } };
      delete data.branchId;
    }
    return productRepository.update(id, data);
  },
};
