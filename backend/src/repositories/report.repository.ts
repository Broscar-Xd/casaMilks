import { prisma } from '../config/database';

export const reportRepository = {
  salesByProduct: (branchId: string, dateFrom: Date, dateTo: Date) =>
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          branchId,
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true, subtotal: true },
    }),

  salesByTimeSlot: async (branchId: string, start: Date, end: Date) => {
    const orders = await prisma.order.findMany({
      where: {
        branchId,
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      select: { createdAt: true, total: true },
    });

    const slots: Record<number, { total: number; count: number }> = {};
    for (let i = 0; i < 24; i++) slots[i] = { total: 0, count: 0 };

    // Hora en ECUADOR (el servidor corre en UTC y getHours() daría la hora equivocada)
    const hourFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'America/Guayaquil',
    });

    for (const order of orders) {
      const hour = parseInt(hourFormatter.format(order.createdAt), 10) % 24;
      slots[hour].total += Number(order.total);
      slots[hour].count += 1;
    }

    return Object.entries(slots)
      .filter(([_, v]) => v.count > 0)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        total: data.total,
        count: data.count,
      }));
  },

  dailySummary: async (branchId: string, dateFrom: Date, dateTo: Date) => {
    const orders = await prisma.order.findMany({
      where: {
        branchId,
        createdAt: { gte: dateFrom, lte: dateTo },
        status: { not: 'CANCELLED' },
      },
      select: { total: true },
    });

    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalTransactions = orders.length;
    const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    return [{
      total_sales: totalSales,
      total_transactions: totalTransactions,
      avg_ticket: avgTicket,
    }];
  },

  paymentsByMethod: (branchId: string, dateFrom: Date, dateTo: Date) =>
    prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: {
          branchId,
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { amount: true },
      _count: true,
    }),
};
