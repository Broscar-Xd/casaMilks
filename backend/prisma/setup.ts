import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Espera a que PostgreSQL esté listo para aceptar conexiones */
async function waitForDb(retries = 30, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Base de datos conectada');
      return;
    } catch {
      console.log(`⏳ Esperando base de datos... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('No se pudo conectar a la base de datos');
}

async function main() {
  await waitForDb();

  console.log('🚀 Ejecutando setup de base de datos...');

  // Push schema
  const { execSync } = await import('child_process');
  console.log('📦 Sincronizando schema...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

  // Seed
  console.log('🌱 Ejecutando seed...');
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });

  console.log('✅ Setup completado');
}

main()
  .catch((e) => {
    console.error('❌ Error en setup:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
