import { categoryRepository } from '../repositories/category.repository';
import { AppError } from '../middlewares/errorHandler';
import { CreateCategoryInput, UpdateCategoryInput, SaveComboLinesInput } from '../validators/category.validator';

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

  // Combo lines
  getComboLines: (categoryId: string) => categoryRepository.getComboLines(categoryId),

  saveComboLines: async (categoryId: string, input: SaveComboLinesInput) => {
    const category = await categoryRepository.findById(categoryId);
    if (!category) throw new AppError('Categoría no encontrada', 404);

    // Delete existing lines and recreate
    await categoryRepository.deleteComboLines(categoryId);

    for (const line of input.lines) {
      await categoryRepository.createComboLine({
        categoryId,
        ...line,
      });
    }

    return categoryRepository.getComboLines(categoryId);
  },
};
