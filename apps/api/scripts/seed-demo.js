const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const phone = "11999999999";
  const existing = await prisma.user.findFirst({ where: { phone } });
  if (existing) {
    console.log(JSON.stringify({ ok: true, existing: true, phone, userId: existing.id, businessId: existing.businessId }));
    return;
  }

  const business = await prisma.business.create({
    data: {
      name: "Salao Demo Bela360",
      slug: "salao-demo-bela360",
      phone,
      email: "demo@bela360.local",
      type: "SALON",
      status: "ACTIVE",
      users: {
        create: {
          name: "Admin Demo",
          phone,
          email: "demo@bela360.local",
          role: "OWNER",
          isActive: true,
        },
      },
    },
    include: { users: true },
  });

  console.log(JSON.stringify({
    ok: true,
    existing: false,
    phone,
    businessId: business.id,
    userId: business.users[0].id,
  }));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());