import { tableRepository } from '../repositories/table.repository';
import { AppError } from '../middlewares/errorHandler';
import { CreateTableInput, UpdateTableInput } from '../validators/table.validator';

export const tableService = {
  listByBranch: (branchId: string) => tableRepository.listByBranch(branchId),

  getById: async (id: string) => {
    const table = await tableRepository.findById(id);
    if (!table) throw new AppError('Mesa no encontrada', 404);
    return table;
  },

  create: (input: CreateTableInput) => tableRepository.create(input),

  update: (id: string, input: UpdateTableInput) => tableRepository.update(id, input),

  delete: async (id: string) => {
    const table = await tableRepository.findById(id);
    if (!table) throw new AppError('Mesa no encontrada', 404);
    const activeOrder = table.orders?.find(o => o.status !== 'CLOSED');
    if (activeOrder) throw new AppError('No se puede eliminar una mesa con una cuenta activa');
    return tableRepository.delete(id);
  },
};
