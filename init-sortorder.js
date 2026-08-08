/* Inicializa sortOrder de categorías existentes (1, 2, 3...) según el orden por nombre.
 * Preserva los sortOrder ya asignados y asigna los faltantes después del máximo. */
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const cats = await p.category.findMany({ orderBy: { name: 'asc' } });
  console.log('Categorías encontradas:', cats.length);

  // Máximo sortOrder existente
  const maxExisting = Math.max(0, ...cats.map((c) => c.sortOrder || 0));
  let next = maxExisting + 1;

  // Ordenar por nombre y asignar secuencial a los que tienen 0
  const sorted = [...cats].sort((a, b) => a.name.localeCompare(b.name));
  let assigned = 0;
  for (const c of sorted) {
    if (!c.sortOrder || c.sortOrder === 0) {
      await p.category.update({ where: { id: c.id }, data: { sortOrder: next } });
      console.log(`  ${next}. ${c.name} (asignado)`);
      next++;
      assigned++;
    } else {
      console.log(`  ${c.sortOrder}. ${c.name} (ya tenía)`);
    }
  }
  console.log(`\n✅ ${assigned} categorías actualizadas`);
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
