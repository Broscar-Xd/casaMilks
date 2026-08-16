import { supplierRepository } from '../repositories/supplier.repository';
import { CreateSupplierPaymentInput } from '../validators/supplier.validator';
import { startOfEcuadorDay, endOfEcuadorDay } from '../utils/date';

export const supplierService = {
  list: async (branchId: string, dateFrom?: string, dateTo?: string, supplierName?: string) => {
    const parsedFrom = dateFrom ? startOfEcuadorDay(dateFrom) : undefined;
    const parsedTo = dateTo ? endOfEcuadorDay(dateTo) : undefined;
    return supplierRepository.list(branchId, parsedFrom, parsedTo, supplierName);
  },

  /** Total pagado a proveedores en el día, con desglose efectivo/transferencia (para el dashboard). */
  sumByDate: async (branchId: string, date: string) => {
    // Día completo en Ecuador: 00:00:00.000 → 23:59:59.999 (UTC-5)
    const start = startOfEcuadorDay(date);
    const end = endOfEcuadorDay(date);
    const result = await supplierRepository.sumByDate(branchId, start, end);
    return {
      total: Number(result._sum?.total || 0),
      cashTotal: Number(result._sum?.cashAmount || 0),
      transferTotal: Number(result._sum?.transferAmount || 0),
    };
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

  /** Elimina un pago a proveedor (registro erróneo). */
  remove: async (id: string) => {
    const existing = await supplierRepository.findById(id);
    if (!existing) throw new Error('Pago no encontrado');
    return supplierRepository.remove(id);
  },
};
