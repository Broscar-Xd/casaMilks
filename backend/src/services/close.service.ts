import { orderRepository } from '../repositories/order.repository';
import { reportRepository } from '../repositories/report.repository';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';
import { CloseDayInput } from '../validators/close.validator';
import { startOfEcuadorDay, ecuadorDateStr } from '../utils/date';

export const closeService = {
  /**
   * Realiza el cierre de caja diario para un local.
   * Calcula totales, ticket promedio y desglose por forma de pago.
   * Solo se puede cerrar una vez por día por local.
   */
  execute: async (input: CloseDayInput, userId: string) => {
    // El cierre queda registrado al día de Ecuador (UTC-5), no al del servidor (UTC)
    const closeDate = startOfEcuadorDay(
      ecuadorDateStr(input.closeDate ? new Date(input.closeDate) : new Date())
    );
    const nextDay = new Date(closeDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Verificar que no exista un cierre para esta fecha
    const existingClose = await prisma.dailyClose.findUnique({
      where: { branchId_closeDate: { branchId: input.branchId, closeDate } },
    });

    if (existingClose) {
      throw new AppError('Ya existe un cierre para esta fecha en este local');
    }

    const transactions = await orderRepository.countByBranchAndDate(input.branchId, closeDate);
    const totals = await orderRepository.sumByBranchAndDate(input.branchId, closeDate);
    const payments = await reportRepository.paymentsByMethod(input.branchId, closeDate, nextDay);

    const totalSales = Number(totals._sum.total || 0);
    const averageTicket = transactions > 0 ? totalSales / transactions : 0;

    const extractAmount = (method: string) => {
      const found = payments.find((p) => p.method === method);
      return found ? Number(found._sum.amount || 0) : 0;
    };

    // Calcular pagos a proveedores del día
    const supplierTotal = await prisma.supplierPayment.aggregate({
      where: {
        branchId: input.branchId,
        createdAt: { gte: closeDate, lt: nextDay },
      },
      _sum: { total: true },
    });
    const totalCost = Number(supplierTotal._sum.total || 0);
    const netProfit = totalSales - totalCost;

    return prisma.dailyClose.create({
      data: {
        branchId: input.branchId,
        userId,
        closeDate,
        totalSales,
        totalCost,
        netProfit,
        totalTransactions: transactions,
        averageTicket,
        cashTotal: extractAmount('CASH'),
        cardTotal: extractAmount('CARD'),
        transferTotal: extractAmount('TRANSFER'),
        deunaTotal: extractAmount('DEUNA'),
        panapayTotal: extractAmount('PANAPAY'),
        closedAt: new Date(),
        notes: input.notes,
      },
    });
  },

  list: (branchId: string) =>
    prisma.dailyClose.findMany({
      where: { branchId },
      orderBy: { closeDate: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    }),

  getByDate: (branchId: string, date: string) =>
    prisma.dailyClose.findUnique({
      where: {
        branchId_closeDate: {
          branchId,
          closeDate: startOfEcuadorDay(date),
        },
      },
    }),
};
