/**
 * RECALCULA los cierres diarios históricos con la lógica CORREGIDA.
 * El bug era que countByBranchAndDate/sumByBranchAndDate usaban setHours(0,0,0,0)
 * sobre una fecha que ya era medianoche de Ecuador (05:00 UTC), corriendo la
 * ventana 5h (19:00 del día anterior → 18:59 del día del cierre).
 *
 * Este script recalcula para cada DailyClose:
 *   - totalSales        (suma de pedidos CLOSED del día Ecuador)
 *   - totalTransactions (cantidad de pedidos CLOSED del día)
 *   - averageTicket     (totalSales / transacciones)
 *   - netProfit         (totalSales − totalCost guardado)
 *
 * El desglose por método de pago (cashTotal, cardTotal, etc.) NO se toca:
 * ese cálculo ya era correcto.
 *
 * Ejecutar en Railway:
 *   railway ssh -- 'cd /app/backend && npx tsx fixCloses.ts'
 */
import { prisma } from './src/config/database';

async function main() {
  const closes = await prisma.dailyClose.findMany({ orderBy: { closeDate: 'asc' } });
  console.log(`Cierres a recalcular: ${closes.length}\n`);

  let updated = 0;
  for (const c of closes) {
    // closeDate ya es medianoche de Ecuador (guardado como 05:00 UTC)
    const start = new Date(c.closeDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 1); // día siguiente, misma hora Ecuador

    const [count, agg] = await Promise.all([
      prisma.order.count({
        where: { branchId: c.branchId, createdAt: { gte: start, lt: end }, status: 'CLOSED' },
      }),
      prisma.order.aggregate({
        where: { branchId: c.branchId, createdAt: { gte: start, lt: end }, status: 'CLOSED' },
        _sum: { total: true },
      }),
    ]);

    const totalSales = Number(agg._sum.total || 0);
    const averageTicket = count > 0 ? totalSales / count : 0;
    const netProfit = totalSales - Number(c.totalCost);

    await prisma.dailyClose.update({
      where: { id: c.id },
      data: { totalSales, totalTransactions: count, averageTicket, netProfit },
    });

    console.log(
      `${c.closeDate.toISOString().slice(0, 10)} → ventas ${totalSales.toFixed(2)} (${count} trans, ticket ${averageTicket.toFixed(2)}, neto ${netProfit.toFixed(2)})`
    );
    updated++;
  }

  console.log(`\n✅ ${updated} cierres recalculados correctamente.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
