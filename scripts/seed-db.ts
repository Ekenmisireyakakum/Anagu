/**
 * ANAGU — Database seed script
 * Run with: cd packages/database && npx ts-node ../../scripts/seed-db.ts
 *
 * Seeds initial admin user and sample data for development.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ANAGU database...');

  // Seed roles: Governor, Land Administrator, Registrar (dev accounts)
  const governor = await prisma.user.upsert({
    where: { email: 'governor@anagu.dev' },
    update: {},
    create: {
      email: 'governor@anagu.dev',
      // bcrypt hash of 'dev-password-change-in-prod'
      passwordHash: '$2b$10$placeholder_hash_replace_before_use',
      role: 'GOVERNOR',
      fullName: 'Dev Governor',
      isActive: true,
    },
  });

  const registrar = await prisma.user.upsert({
    where: { email: 'registrar@anagu.dev' },
    update: {},
    create: {
      email: 'registrar@anagu.dev',
      passwordHash: '$2b$10$placeholder_hash_replace_before_use',
      role: 'REGISTRAR',
      fullName: 'Dev Registrar',
      isActive: true,
    },
  });

  console.log(`Seeded users: governor(${governor.id}), registrar(${registrar.id})`);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
