const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PLANS = [
  {
    slug: 'standard',
    name: 'Standard',
    description: 'Базовая статистика и обычные роли. Один салон, 5 сотрудников, 100 SMS.',
    price: 300000,
    maxSalons: 1,
    maxEmployees: 5,
    includedSms: 100,
    statsLevel: 'basic',
    auditLevel: 'none',
    canExport: false,
    advancedRoles: false,
    apiAccess: false,
    prioritySupport: false,
    recommended: false,
  },
  {
    slug: 'business',
    name: 'Business',
    description: 'Расширенная статистика, журнал действий, экспорт и гибкие права. До 3 салонов.',
    price: 500000,
    maxSalons: 3,
    maxEmployees: 15,
    includedSms: 300,
    statsLevel: 'extended',
    auditLevel: 'salon',
    canExport: true,
    advancedRoles: true,
    apiAccess: false,
    prioritySupport: false,
    recommended: true,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Сеть, объединённые отчёты, расширенный audit log, API и приоритетная поддержка.',
    price: 1000000,
    maxSalons: 5,
    maxEmployees: 0,
    includedSms: 1000,
    statsLevel: 'network',
    auditLevel: 'extended',
    canExport: true,
    advancedRoles: true,
    apiAccess: true,
    prioritySupport: true,
    recommended: false,
  },
];

const PACKAGES = [
  { name: 'Small', smsCount: 100, price: 25000 },
  { name: 'Medium', smsCount: 500, price: 100000 },
  { name: 'Large', smsCount: 1000, price: 180000 },
  { name: 'Business', smsCount: 5000, price: 750000 },
];

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    await prisma.user.update({
      where: { username },
      data: { role: 'platform', opticsId: null },
    });
  } else {
    await prisma.user.create({
      data: { username, passwordHash, role: 'platform' },
    });
  }
  console.log(`Платформенный админ готов: ${username}`);

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: { ...plan, currency: 'UZS', billingPeriod: 'month' },
      update: {
        statsLevel: plan.statsLevel,
        auditLevel: plan.auditLevel,
        canExport: plan.canExport,
        advancedRoles: plan.advancedRoles,
        apiAccess: plan.apiAccess,
        prioritySupport: plan.prioritySupport,
        recommended: plan.recommended,
        description: plan.description,
      },
    });
  }
  console.log('Тарифы готовы');

  const packCount = await prisma.smsPackage.count();
  if (packCount === 0) {
    await prisma.smsPackage.createMany({ data: PACKAGES });
  }
  console.log('SMS-пакеты готовы');

  const standard = await prisma.plan.findUnique({ where: { slug: 'standard' } });
  const orgs = await prisma.organization.findMany({
    include: { wallet: true, subscriptions: { where: { status: 'ACTIVE' } } },
  });
  for (const org of orgs) {
    if (!org.wallet) {
      await prisma.smsWallet.create({ data: { organizationId: org.id, balance: 0 } });
    }
    if (org.subscriptions.length === 0 && standard) {
      const startedAt = new Date();
      const expiresAt = new Date(startedAt);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: standard.id,
          status: 'ACTIVE',
          startedAt,
          expiresAt,
        },
      });
      if (standard.includedSms > 0) {
        const wallet = await prisma.smsWallet.findUnique({
          where: { organizationId: org.id },
        });
        const next = (wallet?.balance ?? 0) + standard.includedSms;
        await prisma.smsWallet.update({
          where: { organizationId: org.id },
          data: { balance: next },
        });
        await prisma.smsTransaction.create({
          data: {
            organizationId: org.id,
            amount: standard.includedSms,
            type: 'SUBSCRIPTION_BONUS',
            description: `SMS по тарифу «${standard.name}»`,
            balanceAfter: next,
          },
        });
      }
    }
  }
  console.log(`Организации: ${orgs.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
