const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function fetchGolden() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const ids = ["69000872297", "69000872352", "69000874233", "69000874378", "69000874402", "69000874252"];
  const articles = await prisma.article.findMany({
    where: { freshdeskId: { in: ids } },
    select: { freshdeskId: true, title: true, description: true }
  });

  console.log(`Found ${articles.length} golden articles in DB.`);
  const fs = require('fs');
  fs.writeFileSync('golden-articles.json', JSON.stringify(articles, null, 2));

  await prisma.$disconnect();
  await pool.end();
}

fetchGolden();
