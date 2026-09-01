/**
 * VERIFICACIÓN del cierre de caja.
 * Para cada DailyClose existente, recalcula con la lógica corregida
 * (ventana [00:00, 24:00) hora Ecuador) y compara contra lo guardado.
 *
 * Ejecutar en Railway: railway ssh -- 'cd /app/backend && npx tsx verifyCloses.ts'
 */
import { prisma } from './src/config/database';

async function main() {
  const closes = await prisma.dailyClose.findMany({ orderBy: { closeDate: 'asc' } });
  console.log(`Cierres a verificar: ${closes.length}\n`);

  let allOk = true;
  for (const c of closes) {
    const start = new Date(c.closeDate); // 00:00 Ecuador (05:00 UTC)
    const end = new Date(start);
    end.setDate(end.getDate() + 1); // 00:00 Ecuador del día siguiente

    const [count, agg, payments, supplierAgg] = await Promise.all([
      prisma.order.count({
        where: { branchId: c.branchId, createdAt: { gte: start, lt: end }, status: 'CLOSED' },
      }),
      prisma.order.aggregate({
        where: { branchId: c.branchId, createdAt: { gte: start, lt: end }, status: 'CLOSED' },
        _sum: { total: true },
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: { order: { branchId: c.branchId, createdAt: { gte: start, lt: end }, status: 'CLOSED' } },
        _sum: { amount: true },
      }),
      prisma.supplierPayment.aggregate({
        where: { branchId: c.branchId, createdAt: { gte: start, lt: end } },
        _sum: { total: true },
      }),
    ]);

    const totalSales = Number(agg._sum.total || 0);
    const avgTicket = count > 0 ? totalSales / count : 0;
    const totalCost = Number(supplierAgg._sum.total || 0);
    const netProfit = totalSales - totalCost;

    const extract = (m: string) => Number(payments.find(p => p.method === m)?._sum.amount || 0);

    const diffs: string[] = [];
    if (Math.abs(Number(c.totalSales) - totalSales) > 0.01) diffs.push(`totalSales: guardado ${c.totalSales} vs real ${totalSales.toFixed(2)}`);
    if (c.totalTransactions !== count) diffs.push(`transacciones: guardado ${c.totalTransactions} vs real ${count}`);
    if (Math.abs(Number(c.averageTicket) - avgTicket) > 0.01) diffs.push(`ticket: guardado ${c.averageTicket} vs real ${avgTicket.toFixed(2)}`);
    if (Math.abs(Number(c.totalCost) - totalCost) > 0.01) diffs.push(`costo: guardado ${c.totalCost} vs real ${totalCost.toFixed(2)}`);
    if (Math.abs(Number(c.netProfit) - netProfit) > 0.01) diffs.push(`neto: guardado ${c.netProfit} vs real ${netProfit.toFixed(2)}`);
    if (Math.abs(Number(c.cashTotal) - extract('CASH')) > 0.01) diffs.push(`efectivo: guardado ${c.cashTotal} vs real ${extract('CASH').toFixed(2)}`);
    if (Math.abs(Number(c.cardTotal) - extract('CARD')) > 0.01) diffs.push(`tarjeta: guardado ${c.cardTotal} vs real ${extract('CARD').toFixed(2)}`);
    if (Math.abs(Number(c.transferTotal) - extract('TRANSFER')) > 0.01) diffs.push(`transferencia: guardado ${c.transferTotal} vs real ${extract('TRANSFER').toFixed(2)}`);
    if (Math.abs(Number(c.deunaTotal) - extract('DEUNA')) > 0.01) diffs.push(`deuna: guardado ${c.deunaTotal} vs real ${extract('DEUNA').toFixed(2)}`);
    if (Math.abs(Number(c.panapayTotal) - extract('PANAPAY')) > 0.01) diffs.push(`panapay: guardado ${c.panapayTotal} vs real ${extract('PANAPAY').toFixed(2)}`);

    const fecha = c.closeDate.toISOString().slice(0, 10);
    if (diffs.length === 0) {
      console.log(`✅ ${fecha} — OK (ventas ${totalSales.toFixed(2)}, ${count} trans, efectivo ${extract('CASH').toFixed(2)})`);
    } else {
      allOk = false;
      console.log(`❌ ${fecha} — ${diffs.join(' | ')}`);
    }
  }

  console.log(allOk ? '\n🎉 TODOS los cierres están correctos.' : '\n⚠️ Hay diferencias — revisar arriba.');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());