const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Checking services...');

  // Only seed the 4 predefined services if none exist yet.
  // config/database.js performs the same check on every server start,
  // so this seed script is only needed for fresh environments.
  const count = await prisma.service.count();

  if (count === 0) {
    await prisma.service.createMany({
      data: [
        {
          name: 'Emergency Plumbing Repair',
          description: '24/7 emergency plumbing services including burst pipes, clogs, and water heater issues',
          category: 'PLUMBING',
          basePrice: 150,
          priceUnit: 'JOB',
          duration: 120,
          availability: {
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            hours: { start: '00:00', end: '23:59' }
          },
          emergency: { available: true, extraCharge: 100, responseTime: '2 hours' },
          requirements: ['Access to main water shut-off valve', 'Clear work area', 'Parking available'],
          images: [],
          isActive: true,
          isPopular: true
        },
        {
          name: 'Electrical Installation',
          description: 'Professional electrical installation for outlets, switches, and lighting fixtures',
          category: 'ELECTRICAL',
          basePrice: 200,
          priceUnit: 'JOB',
          duration: 180,
          availability: {
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            hours: { start: '08:00', end: '18:00' }
          },
          emergency: { available: true, extraCharge: 150, responseTime: '4 hours' },
          requirements: ['Access to electrical panel', 'Clear work area', 'Power off if requested'],
          images: [],
          isActive: true,
          isPopular: true
        },
        {
          name: 'HVAC Maintenance',
          description: 'Complete HVAC system maintenance including filter replacement and system check',
          category: 'HVAC',
          basePrice: 120,
          priceUnit: 'JOB',
          duration: 90,
          availability: {
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            hours: { start: '08:00', end: '17:00' }
          },
          emergency: { available: true, extraCharge: 200, responseTime: '6 hours' },
          requirements: ['Access to HVAC unit', 'Clear work area', 'Pets secured'],
          images: [],
          isActive: true,
          isPopular: false
        },
        {
          name: 'Emergency Locksmith Service',
          description: '24/7 emergency locksmith services for home and automotive lockouts',
          category: 'LOCKSMITH',
          basePrice: 100,
          priceUnit: 'JOB',
          duration: 60,
          availability: {
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            hours: { start: '00:00', end: '23:59' }
          },
          emergency: { available: true, extraCharge: 50, responseTime: '30 minutes' },
          requirements: ['Proof of ownership/ID', 'Clear access to lock', 'Parking available'],
          images: [],
          isActive: true,
          isPopular: true
        }
      ]
    });
    console.log('✅ Services created');
  } else {
    console.log(`ℹ️  Skipped — ${count} service(s) already exist`);
  }

  console.log('\n✅ Seed complete. No dummy users or test data.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
