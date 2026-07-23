import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Crear local principal
  const branch = await prisma.branch.upsert({
    where: { name: 'Casa Milks - Principal' },
    update: {},
    create: {
      name: 'Casa Milks - Principal',
      address: 'Latacunga, Ecuador',
      phone: '0999999999',
      fiscalConfig: {
        create: {
          ruc: '9999999999999',
          businessName: 'CASA MILKS',
          tradeName: 'CASA MILKS',
          address: 'Latacunga, Ecuador',
          receiptAuthorization: '1234567890',
          rimpeLegend: 'Contribuyente RIMPE Negocio Popular',
        },
      },
    },
  });

  console.log(`✅ Local creado: ${branch.name}`);

  // Crear administrador
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { name: 'Administrador' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@casamilks.com',
      password: adminPassword,
      role: 'ADMIN',
      branchId: branch.id,
    },
  });

  console.log(`✅ Admin creado: ${admin.name} (${admin.email})`);

  // Crear personal
  const staffPassword = await bcrypt.hash('staff123', 12);
  const staff = await prisma.user.upsert({
    where: { name: 'Personal' },
    update: {},
    create: {
      name: 'Personal',
      email: 'staff@casamilks.com',
      password: staffPassword,
      role: 'STAFF',
      branchId: branch.id,
    },
  });

  console.log(`✅ Staff creado: ${staff.name} (${staff.email})`);

  // Crear categorías
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Clásicos' },
      update: {},
      create: { name: 'Clásicos', description: 'Sándwiches clásicos de la casa' },
    }),
    prisma.category.upsert({
      where: { name: 'Especiales' },
      update: {},
      create: { name: 'Especiales', description: 'Sándwiches especiales' },
    }),
    prisma.category.upsert({
      where: { name: 'Bebidas' },
      update: {},
      create: { name: 'Bebidas', description: 'Bebidas y refrescos' },
    }),
    prisma.category.upsert({
      where: { name: 'Extras' },
      update: {},
      create: { name: 'Extras', description: 'Complementos y adicionales' },
    }),
  ]);

  console.log(`✅ ${categories.length} categorías creadas`);

  // Crear productos
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Sándwich de Pollo',
        description: 'Pollo, lechuga, tomate y mayonesa',
        price: 5.50,
        requiresPreparation: true,
        categoryId: categories[0].id,
        branchId: branch.id,
      },
    }),
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Sándwich de Jamón y Queso',
        description: 'Jamón, queso mozzarella y aliños',
        price: 4.50,
        requiresPreparation: true,
        categoryId: categories[0].id,
        branchId: branch.id,
      },
    }),
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Sándwich Havarti',
        description: 'Queso havarti, pavo y vegetales',
        price: 6.00,
        requiresPreparation: true,
        categoryId: categories[1].id,
        branchId: branch.id,
      },
    }),
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Coca Cola 355ml',
        description: 'Bebida gaseosa',
        price: 1.50,
        requiresPreparation: false,
        categoryId: categories[2].id,
        branchId: branch.id,
      },
    }),
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000005' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'Papas Fritas',
        description: 'Porción de papas fritas crujientes',
        price: 2.50,
        requiresPreparation: false,
        categoryId: categories[3].id,
        branchId: branch.id,
      },
    }),
  ]);

  console.log(`✅ ${products.length} productos creados`);

  // Crear insumos
  const ingredients = await Promise.all([
    prisma.ingredient.upsert({
      where: { name: 'Pan artesanal' },
      update: {},
      create: { name: 'Pan artesanal', unit: 'unidad', minStock: 20 },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Pechuga de pollo' },
      update: {},
      create: { name: 'Pechuga de pollo', unit: 'kg', minStock: 5 },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Lechuga' },
      update: {},
      create: { name: 'Lechuga', unit: 'kg', minStock: 3 },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Tomate' },
      update: {},
      create: { name: 'Tomate', unit: 'kg', minStock: 3 },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Queso mozzarella' },
      update: {},
      create: { name: 'Queso mozzarella', unit: 'kg', minStock: 5 },
    }),
    prisma.ingredient.upsert({
      where: { name: 'Jamón' },
      update: {},
      create: { name: 'Jamón', unit: 'kg', minStock: 3 },
    }),
  ]);

  console.log(`✅ ${ingredients.length} insumos creados`);

  // Stock inicial
  for (const ingredient of ingredients) {
    await prisma.inventoryItem.upsert({
      where: {
        ingredientId_branchId: {
          ingredientId: ingredient.id,
          branchId: branch.id,
        },
      },
      update: {},
      create: {
        ingredientId: ingredient.id,
        branchId: branch.id,
        quantity: 50,
      },
    });
  }

  console.log('✅ Stock inicial creado');

  // Crear mesas
  const tableNames = ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa Terraza 1', 'Mesa Terraza 2', 'Mesa VIP'];
  for (const name of tableNames) {
    await prisma.table.upsert({
      where: { branchId_name: { branchId: branch.id, name } },
      update: {},
      create: { name, branchId: branch.id },
    });
  }

  console.log(`✅ ${tableNames.length} mesas creadas`);

  console.log('\n🎉 Seed completado exitosamente');
  console.log('\n📧 Credenciales de prueba (usar NOMBRE de usuario):');
  console.log('   Admin: Administrador / admin123');
  console.log('   Staff: Personal / staff123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
