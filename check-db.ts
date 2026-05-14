import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function checkConnection() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in your environment variables.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
  });

  try {

    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    console.log('✅ Connection successful!');
    console.log('Tables:', tables.map((t: { tablename: string }) => t.tablename));
  } catch (error) {
    console.error('❌ Connection failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnection();