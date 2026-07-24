import { supplierRepository } from '../repositories/supplier.repository';
import { CreateSupplierPaymentInput } from '../validators/supplier.validator';

export const supplierService = {
  list: async (branchId: string, dateFrom?: string, dateTo?: string, supplierName?: string) => {
    const parsedFrom = dateFrom ? new Date(dateFrom) : undefined;
    const parsedTo = dateTo ? new Date(dateTo) : undefined;
    return supplierRepository.list(branchId, parsedFrom, parsedTo, supplierName);
  },

  create: async (input: CreateSupplierPaymentInput & { branchId: string }) => {
    const cashAmount = Number(input.cashAmount || 0);
    const transferAmount = Number(input.transferAmount || 0);
    const total = cashAmount + transferAmount;

    if (total <= 0) {
      throw new Error('El monto total debe ser mayor a 0');
    }

    return supplierRepository.create({
      branchId: input.branchId,
      supplierName: input.supplierName,
      cashAmount,
      transferAmount,
      total,
      notes: input.notes,
    });
  },

  listSuppliers: (branchId: string) => supplierRepository.listSuppliers(branchId),
};
