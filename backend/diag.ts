/**
 * DIAGNÓSTICO del error "Unique constraint failed on (branch_id, type, sequential)".
 * Consulta el estado de las secuencias vs los comprobantes existentes.
 * Ejecutar en Railway: railway ssh -- 'cd /app/backend && npx tsx diag.ts'
 */
import { prisma } from './src/config/database';

async function main() {
  // 1. Secuencias registradas
  const seqs = await prisma.receiptSequence.findMany();
  console.log('=== RECEIPT SEQUENCES ===');
  console.log(JSON.stringify(seqs, null, 2));

  // 2. Máximo secuencial y conteo por tipo
  const byType = await prisma.electronicReceipt.groupBy({
    by: ['branchId', 'type'],
    _max: { sequential: true },
    _count: true,
  });
  console.log('\n=== MAX SEQUENTIAL POR (branch, type) ===');
  console.log(JSON.stringify(byType, null, 2));

  // 3. Duplicados (branch, type, sequential)
  const dups = await prisma.electronicReceipt.groupBy({
    by: ['branchId', 'type', 'sequential'],
    _count: true,
    having: { sequential: { gt: 0 } },
  });
  const realDups = dups.filter(d => d._count > 1);
  console.log('\n=== DUPLICADOS (branch, type, sequential) ===');
  console.log(realDups.length === 0 ? 'No hay duplicados' : JSON.stringify(realDups, null, 2));

  // 4. Últimas 10 facturas (para ver el patrón de secuenciales)
  const last = await prisma.electronicReceipt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, orderId: true, type: true, sequential: true, status: true, createdAt: true },
  });
  console.log('\n=== ÚLTIMAS 10 FACTURAS ===');
  console.log(JSON.stringify(last, null, 2));
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());