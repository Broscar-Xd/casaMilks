import { branchRepository } from '../repositories/branch.repository';
import { AppError } from '../middlewares/errorHandler';
import { CreateBranchInput, UpdateBranchInput, UpdateFiscalConfigInput } from '../validators/branch.validator';

export const branchService = {
  list: () => branchRepository.list(),

  getById: async (id: string) => {
    const branch = await branchRepository.findById(id);
    if (!branch) throw new AppError('Local no encontrado', 404);
    return branch;
  },

  create: (input: CreateBranchInput) => branchRepository.create(input),

  update: (id: string, input: UpdateBranchInput) => branchRepository.update(id, input),

  updateFiscalConfig: (branchId: string, input: UpdateFiscalConfigInput) =>
    branchRepository.upsertFiscalConfig(branchId, input),
};
