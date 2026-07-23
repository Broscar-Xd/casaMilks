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

  console.log(`✅ Admin creado: ${admin.name}`);

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

  console.log(`✅ Staff creado: ${staff.name}`);

  console.log('\n🎉 Seed completado — solo datos esenciales creados');
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
