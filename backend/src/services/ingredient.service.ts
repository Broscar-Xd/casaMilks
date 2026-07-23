import { ingredientRepository } from '../repositories/ingredient.repository';
import { AppError } from '../middlewares/errorHandler';
import { CreateIngredientInput, UpdateIngredientInput } from '../validators/ingredient.validator';

export const ingredientService = {
  list: () => ingredientRepository.list(),

  getById: async (id: string) => {
    const ingredient = await ingredientRepository.findById(id);
    if (!ingredient) throw new AppError('Insumo no encontrado', 404);
    return ingredient;
  },

  create: (input: CreateIngredientInput) =>
    ingredientRepository.create({
      name: input.name,
      unit: input.unit || 'unidad',
      minStock: input.minStock || 0,
    }),

  update: (id: string, input: UpdateIngredientInput) => ingredientRepository.update(id, input),
};
