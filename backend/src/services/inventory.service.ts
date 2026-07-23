import { inventoryRepository } from '../repositories/inventory.repository';
import { ingredientRepository } from '../repositories/ingredient.repository';
import { AppError } from '../middlewares/errorHandler';
import { AdjustInventoryInput } from '../validators/inventory.validator';

export const inventoryService = {
  getByBranch: (branchId: string) => inventoryRepository.getByBranch(branchId),

  getAlerts: (branchId: string) => inventoryRepository.getStockAlerts(branchId),

  getMovements: (branchId: string, ingredientId?: string) =>
    inventoryRepository.getMovements(branchId, ingredientId),

  /**
   * Ajusta manualmente el stock de un insumo en un local.
   * Registra el movimiento para mantener trazabilidad.
   */
  adjust: async (input: AdjustInventoryInput) => {
    const ingredient = await ingredientRepository.findById(input.ingredientId);
    if (!ingredient) throw new AppError('Insumo no encontrado', 404);

    const existing = await inventoryRepository.getByBranchAndIngredient(
      input.branchId,
      input.ingredientId
    );

    const currentQty = existing ? Number(existing.quantity) : 0;
    const newQty = currentQty + input.quantity;

    if (newQty < 0) {
      throw new AppError('El stock no puede ser negativo');
    }

    await inventoryRepository.upsert(input.branchId, input.ingredientId, newQty);

    await inventoryRepository.createMovement({
      ingredientId: input.ingredientId,
      branchId: input.branchId,
      type: input.quantity >= 0 ? 'IN' : 'OUT',
      quantity: Math.abs(input.quantity),
      notes: input.notes || 'Ajuste manual',
    });

    return inventoryRepository.getByBranchAndIngredient(input.branchId, input.ingredientId);
  },
};
