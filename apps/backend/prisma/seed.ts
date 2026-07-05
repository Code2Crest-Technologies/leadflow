import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  const company = await prisma.company.upsert({
    where: { whatsappPhoneNumber: '+1234567890' },
    update: {},
    create: {
      name: 'code2crest Technologies',
      website: 'www.code2crest.com',
      industry: 'Software Development',
      whatsappPhoneNumber: '+1234567890',
      whatsappBusinessAccountId: 'test-account-id',
      whatsappAccessToken: 'test-access-token',
      subscriptionTier: 'pro',
      maxUsers: 10,
      maxContacts: 5000,
    },
  });

  console.log(`Seeded company: ${company.name}`);

  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const agentPasswordHash = await bcrypt.hash('Agent@123', 10);
  const arunPasswordHash = await bcrypt.hash('Arun@123', 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@code2crest.com' },
      update: { passwordHash: adminPasswordHash },
      create: {
        email: 'admin@code2crest.com',
        passwordHash: adminPasswordHash,
        firstName: 'Admin',
        lastName: 'User',
        companyId: company.id,
        role: 'ADMIN',
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent@code2crest.com' },
      update: { passwordHash: agentPasswordHash },
      create: {
        email: 'agent@code2crest.com',
        passwordHash: agentPasswordHash,
        firstName: 'Agent',
        lastName: 'User',
        companyId: company.id,
        role: 'AGENT',
      },
    }),
    prisma.user.upsert({
      where: { email: 'arun@test.com' },
      update: { passwordHash: arunPasswordHash },
      create: {
        email: 'arun@test.com',
        passwordHash: arunPasswordHash,
        firstName: 'Arun',
        lastName: 'Test',
        companyId: company.id,
        role: 'AGENT',
      },
    }),
  ]);

  console.log(`Seeded ${users.length} users`);

  const contacts = await Promise.all([
    prisma.contact.upsert({
      where: {
        companyId_phoneNumber: {
          companyId: company.id,
          phoneNumber: '+1111111111',
        },
      },
      update: {},
      create: {
        phoneNumber: '+1111111111',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyId: company.id,
        segment: 'LEAD',
        status: 'ACTIVE',
      },
    }),
    prisma.contact.upsert({
      where: {
        companyId_phoneNumber: {
          companyId: company.id,
          phoneNumber: '+1222222222',
        },
      },
      update: {},
      create: {
        phoneNumber: '+1222222222',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        companyId: company.id,
        segment: 'PROSPECT',
        status: 'ACTIVE',
      },
    }),
  ]);

  console.log(`Seeded ${contacts.length} contacts`);
  console.log('Database seed completed successfully!');
  console.log('\nTest credentials:');
  console.log('Email: arun@test.com');
  console.log('Password: Arun@123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
