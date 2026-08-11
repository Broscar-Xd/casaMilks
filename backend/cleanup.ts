/**
 * LIMPIEZA DE BASE DE DATOS — Casa Milks
 * ======================================
 * Borra TODA la data transaccional de prueba y CONSERVA la data maestra real.
 *
 * 🔴 SE BORRA (transaccional / prueba):
 *   - Pedidos, items de pedido, desgloses de combo
 *   - Envíos a cocina (kitchen_sends, items, combos)
 *   - Pagos de órdenes (payments)
 *   - Facturas electrónicas (electronic_receipts) — las secuencias se conservan
 *   - Movimientos de inventario (inventory_movements)
 *   - Cierres diarios (daily_closes)
 *   - Pagos a proveedores (supplier_payments)
 *   - Mesas → estado FREE
 *
 * 🟢 SE CONSERVA (data maestra / real):
 *   - Productos, categorías, insumos, recetas, stock (inventory_items)
 *   - Usuarios, locales, configuración fiscal, firma electrónica
 *   - Secuencias de facturación (ReceiptSequence) — para no reutilizar claves
 *   - Clientes guardados (customers)
 *
 * Ejecutar con las variables de Railway:
 *   railway run npx tsx backend/cleanup.ts
 */
import { prisma } from './src/config/database';

async function main() {
  console.log('🧹 Iniciando limpieza de la base de datos...\n');

  // Contar antes de borrar
  const countsBefore = {
    kitchenSendCombos: await prisma.kitchenSendCombo.count(),
    kitchenSendItems: await prisma.kitchenSendItem.count(),
    kitchenSends: await prisma.kitchenSend.count(),
    orderItemCombos: await prisma.orderItemCombo.count(),
    orderItems: await prisma.orderItem.count(),
    payments: await prisma.payment.count(),
    electronicReceipts: await prisma.electronicReceipt.count(),
    orders: await prisma.order.count(),
    inventoryMovements: await prisma.inventoryMovement.count(),
    dailyCloses: await prisma.dailyClose.count(),
    supplierPayments: await prisma.supplierPayment.count(),
  };
  console.log('📊 Registros a borrar:', countsBefore);

  // ── BORRAR en orden de dependencias (hijos antes que padres) ──
  // Combos de cocina
  await prisma.kitchenSendCombo.deleteMany({});
  // Items de cocina
  await prisma.kitchenSendItem.deleteMany({});
  // Envíos a cocina
  await prisma.kitchenSend.deleteMany({});
  // Desgloses de combo de pedidos
  await prisma.orderItemCombo.deleteMany({});
  // Items de pedido
  await prisma.orderItem.deleteMany({});
  // Pagos de órdenes
  await prisma.payment.deleteMany({});
  // Facturas electrónicas (los XML se pierden — las secuencias NO se tocan)
  await prisma.electronicReceipt.deleteMany({});
  // Pedidos
  await prisma.order.deleteMany({});
  // Movimientos de inventario (solo historial; el stock se conserva)
  await prisma.inventoryMovement.deleteMany({});
  // Cierres diarios
  await prisma.dailyClose.deleteMany({});
  // Pagos a proveedores
  await prisma.supplierPayment.deleteMany({});

  // ── Mesas a FREE ──
  const tables = await prisma.table.updateMany({ data: { status: 'FREE' } });
  console.log(`\n✅ Mesas liberadas: ${tables.count}`);

  // ── VERIFICAR lo que se conserva ──
  const kept = {
    products: await prisma.product.count(),
    categories: await prisma.category.count(),
    ingredients: await prisma.ingredient.count(),
    recipes: await prisma.recipe.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    users: await prisma.user.count(),
    branches: await prisma.branch.count(),
    receiptSequences: await prisma.receiptSequence.count(),
    signatures: await prisma.digitalSignature.count(),
    customers: await prisma.customer.count(),
  };
  console.log('🟢 Conservado (data real):', kept);

  console.log('\n🎉 Limpieza completada.');
  console.log('   Secuencias de facturación intactas: la próxima factura sigue el correlativo sin conflictos.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la limpieza:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
