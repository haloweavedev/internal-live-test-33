import { PrismaClient } from '@prisma/client'; // Use standard import

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // --- Make sure to replace placeholders below with actual values ---
  const indcCircleSpaceId = 1978096; // *** REPLACE WITH ACTUAL INDC CIRCLE SPACE ID ***
  const indcMonthlyPriceId = 'price_1RDmDcQcqOoXl2I4Cf403OyY'; // *** PASTE ID FROM STRIPE TEST MODE ***
  const indcAnnualPriceId = 'price_1RDmfqQcqOoXl2I4RrltL7GG';   // *** PASTE ID FROM STRIPE TEST MODE ***

  const solasCircleSpaceId = 1978085; // *** REPLACE WITH ACTUAL SOLAS NUA CIRCLE SPACE ID ***
  const solasMonthlyPriceId = 'price_1RDmDCQcqOoXl2I4zCfXe25C'; // *** PASTE ID FROM STRIPE TEST MODE ***
  const solasAnnualPriceId = 'price_1RDme0QcqOoXl2I4vJpmqfTW';   // *** PASTE ID FROM STRIPE TEST MODE ***
  // --- End of values to replace ---

  // Check if placeholder values are still present
  if (
    indcMonthlyPriceId.startsWith('price_YOUR_') ||
    indcAnnualPriceId.startsWith('price_YOUR_') ||
    solasMonthlyPriceId.startsWith('price_YOUR_') ||
    solasAnnualPriceId.startsWith('price_YOUR_')
  ) {
    console.warn("\n⚠️ WARNING: Placeholder Stripe Price IDs found in seed.ts.");
    console.warn("Please replace them with actual IDs from your Stripe Test Dashboard.");
    console.warn("Seeding will continue with placeholders, but checkout will likely fail.\n");
  }

  // --- Create Sample Communities ---
  const community1 = await prisma.community.upsert({
    where: { slug: 'indc-community' },
    update: { // Update existing record with potentially new IDs
      circleSpaceId: indcCircleSpaceId,
      stripePriceIdMonthly: indcMonthlyPriceId,
      stripePriceIdAnnually: indcAnnualPriceId,
    },
    create: {
      name: 'INDC Community',
      slug: 'indc-community',
      description: 'Connect with the Irish Network DC. Engage in discussions, events, and networking.',
      imageUrl: '/images/indc-placeholder.png', // Add a placeholder image
      circleSpaceId: indcCircleSpaceId,
      stripePriceIdMonthly: indcMonthlyPriceId,
      stripePriceIdAnnually: indcAnnualPriceId,
    },
  });
  console.log(`Created/updated community: ${community1.name}`);

  const community2 = await prisma.community.upsert({
    where: { slug: 'solas-nua' },
    update: { // Update existing record with potentially new IDs
      circleSpaceId: solasCircleSpaceId,
      stripePriceIdMonthly: solasMonthlyPriceId,
      stripePriceIdAnnually: solasAnnualPriceId,
    },
    create: {
      name: 'Solas Nua',
      slug: 'solas-nua',
      description: 'Explore contemporary Irish arts and culture. Join the conversation.',
      imageUrl: '/images/solas-placeholder.png', // Add a placeholder image
      circleSpaceId: solasCircleSpaceId,
      stripePriceIdMonthly: solasMonthlyPriceId,
      stripePriceIdAnnually: solasAnnualPriceId,
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