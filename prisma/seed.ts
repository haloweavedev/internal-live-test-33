import { PrismaClient } from '../app/generated/prisma'; // Adjust path if needed

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // --- Create Sample Communities ---
  // Replace with your ACTUAL Circle Space IDs and Stripe TEST Price IDs
  const community1 = await prisma.community.upsert({
    where: { slug: 'indc-community' },
    update: {},
    create: {
      name: 'INDC Community',
      slug: 'indc-community',
      description: 'Connect with the Irish Network DC. Engage in discussions, events, and networking.',
      imageUrl: '/images/indc-placeholder.png', // Add a placeholder image
      circleSpaceId: 1111111, // *** REPLACE WITH ACTUAL CIRCLE SPACE ID ***
      stripePriceIdMonthly: 'price_TEST_MONTHLY_INDC', // *** REPLACE WITH ACTUAL STRIPE TEST PRICE ID ***
      stripePriceIdAnnually: 'price_TEST_ANNUAL_INDC', // *** REPLACE WITH ACTUAL STRIPE TEST PRICE ID ***
    },
  });
  console.log(`Created/updated community: ${community1.name}`);

  const community2 = await prisma.community.upsert({
    where: { slug: 'solas-nua' },
    update: {},
    create: {
      name: 'Solas Nua',
      slug: 'solas-nua',
      description: 'Explore contemporary Irish arts and culture. Join the conversation.',
      imageUrl: '/images/solas-placeholder.png', // Add a placeholder image
      circleSpaceId: 2222222, // *** REPLACE WITH ACTUAL CIRCLE SPACE ID ***
      stripePriceIdMonthly: 'price_TEST_MONTHLY_SOLAS', // *** REPLACE WITH ACTUAL STRIPE TEST PRICE ID ***
      stripePriceIdAnnually: 'price_TEST_ANNUAL_SOLAS', // *** REPLACE WITH ACTUAL STRIPE TEST PRICE ID ***
    },
  });
  console.log(`Created/updated community: ${community2.name}`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 