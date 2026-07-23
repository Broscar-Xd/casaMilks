import { categoryRepository } from '../repositories/category.repository';
import { AppError } from '../middlewares/errorHandler';
import { CreateCategoryInput, UpdateCategoryInput } from '../validators/category.validator';

export const categoryService = {
  list: () => categoryRepository.list(),

  listAll: () => categoryRepository.listAll(),

  getById: async (id: string) => {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError('Categoría no encontrada', 404);
    return category;
  },

  create: (input: CreateCategoryInput) => categoryRepository.create(input),

  update: (id: string, input: UpdateCategoryInput) => categoryRepository.update(id, input),
};
