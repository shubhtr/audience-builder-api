import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const users = [
  { email: 'admin1@example.com', password: 'Admin1Pass!', role: 'ADMIN' as const },
  { email: 'admin2@example.com', password: 'Admin2Pass!', role: 'ADMIN' as const },
  { email: 'planner1@example.com', password: 'Planner1Pass!', role: 'PLANNER' as const },
  { email: 'planner2@example.com', password: 'Planner2Pass!', role: 'PLANNER' as const },
];

async function main() {
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role },
      create: { email: u.email, passwordHash, role: u.role },
    });
    console.log(`Seeded ${u.role}: ${u.email}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
