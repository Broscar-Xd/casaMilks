/**
 * MIGRACIÓN: corrige el type de los comprobantes existentes.
 *
 * El bug: close() creaba las notas de venta SIN type → Prisma usaba el
 * default 'FACTURA'. Así las notas de venta ocuparon los secuenciales de
 * la secuencia NOTA_VENTA (hasta 634) pero con type=FACTURA, y al emitir
 * una factura SRI (secuencia FACTURA, 148) chocaba → Unique constraint.
 *
 * Este script:
 * 1. Reclasifica a NOTA_VENTA los comprobantes que NO tienen claveAcceso
 *    (las notas de venta del close; las facturas SRI reales siempre tienen
 *    claveAcceso de 49 dígitos).
 * 2. Sincroniza las secuencias: lastUsed = max(sequential) por (branch, type).
 *
 * Ejecutar en Railway: railway ssh -- 'cd /app/backend && npx tsx fixReceiptTypes.ts'
 */
import { prisma } from './src/config/database';

async function main() {
  // 1. Reclasificar notas de venta (sin claveAcceso) → NOTA_VENTA
  const notas = await prisma.electronicReceipt.findMany({
    where: { type: 'FACTURA', claveAcceso: null },
    select: { id: true, sequential: true, createdAt: true },
  });
  console.log(`Notas de venta mal clasificadas (sin claveAcceso): ${notas.length}`);

  for (const n of notas) {
    await prisma.electronicReceipt.update({
      where: { id: n.id },
      data: { type: 'NOTA_VENTA' },
    });
  }
  console.log(`✅ Reclasificadas a NOTA_VENTA: ${notas.length}`);

  // 2. Sincronizar secuencias con el máximo real por (branch, type)
  const groups = await prisma.electronicReceipt.groupBy({
    by: ['branchId', 'type'],
    _max: { sequential: true },
  });
  console.log('\nSincronizando secuencias:');
  for (const g of groups) {
    const max = g._max.sequential || 0;
    const seq = await prisma.receiptSequence.upsert({
      where: { branchId_year_type: { branchId: g.branchId, year: new Date().getFullYear(), type: g.type } },
      create: { branchId: g.branchId, year: new Date().getFullYear(), type: g.type, lastUsed: max },
      update: { lastUsed: max },
    });
    console.log(`  ${g.type}: lastUsed → ${seq.lastUsed}`);
  }

  // 3. Verificación final
  const byType = await prisma.electronicReceipt.groupBy({
    by: ['type'],
    _max: { sequential: true },
    _count: true,
  });
  console.log('\nEstado final:', JSON.stringify(byType, null, 2));
  console.log('\n🎉 Migración completada. La próxima factura SRI usará el secuencial correcto sin chocar.');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());