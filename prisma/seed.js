const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.review.deleteMany();
  await prisma.tracking.deleteMany();
  await prisma.note.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany();
  await prisma.service.deleteMany();

  console.log('🧹 Cleared existing data');

  // Create services
  const services = await Promise.all([
    prisma.service.create({
      data: {
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
        emergency: {
          available: true,
          extraCharge: 100,
          responseTime: '2 hours'
        },
        requirements: ['Access to main water shut-off valve', 'Clear work area', 'Parking available'],
        images: [],
        isActive: true,
        isPopular: true
      }
    }),
    prisma.service.create({
      data: {
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
        emergency: {
          available: true,
          extraCharge: 150,
          responseTime: '4 hours'
        },
        requirements: ['Access to electrical panel', 'Clear work area', 'Power off if requested'],
        images: [],
        isActive: true,
        isPopular: true
      }
    }),
    prisma.service.create({
      data: {
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
        emergency: {
          available: true,
          extraCharge: 200,
          responseTime: '6 hours'
        },
        requirements: ['Access to HVAC unit', 'Clear work area', 'Pets secured'],
        images: [],
        isActive: true,
        isPopular: false
      }
    }),
    prisma.service.create({
      data: {
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
        emergency: {
          available: true,
          extraCharge: 50,
          responseTime: '30 minutes'
        },
        requirements: ['Proof of ownership/ID', 'Clear access to lock', 'Parking available'],
        images: [],
        isActive: true,
        isPopular: true
      }
    })
  ]);

  console.log('✅ Created services');

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const users = await Promise.all([
    // Regular users
    prisma.user.create({
      data: {
        email: 'john.doe@example.com',
        password: hashedPassword,
        name: 'John Doe',
        role: 'USER',
        phone: '+1234567890',
        location: {
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001'
        },
        isVerified: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'jane.smith@example.com',
        password: hashedPassword,
        name: 'Jane Smith',
        role: 'USER',
        phone: '+1234567891',
        location: {
          address: '456 Oak Ave',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101'
        },
        isVerified: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'mike.wilson@example.com',
        password: hashedPassword,
        name: 'Mike Wilson',
        role: 'USER',
        phone: '+1234567892',
        location: {
          address: '789 Pine Rd',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601'
        },
        isVerified: true
      }
    }),
    // Workers
    prisma.user.create({
      data: {
        email: 'bob.plumber@example.com',
        password: hashedPassword,
        name: 'Bob Johnson',
        role: 'WORKER',
        phone: '+1234567893',
        location: {
          address: '321 Elm St',
          city: 'New York',
          state: 'NY',
          zipCode: '10002'
        },
        isVerified: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'sarah.electrician@example.com',
        password: hashedPassword,
        name: 'Sarah Davis',
        role: 'WORKER',
        phone: '+1234567894',
        location: {
          address: '654 Maple Dr',
          city: 'Boston',
          state: 'MA',
          zipCode: '02102'
        },
        isVerified: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'tom.hvac@example.com',
        password: hashedPassword,
        name: 'Tom Wilson',
        role: 'WORKER',
        phone: '+1234567895',
        location: {
          address: '987 Cedar Ln',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60602'
        },
        isVerified: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'lisa.locksmith@example.com',
        password: hashedPassword,
        name: 'Lisa Brown',
        role: 'WORKER',
        phone: '+1234567896',
        location: {
          address: '147 Birch Way',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001'
        },
        isVerified: true
      }
    }),
    // Admin
    prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        phone: '+1234567897',
        isVerified: true
      }
    })
  ]);

  console.log('✅ Created users');

  // Create worker profiles
  const workers = await Promise.all([
    prisma.worker.create({
      data: {
        userId: users[3].id, // Bob Johnson
        bio: 'Professional plumber with 10+ years of experience. Specialized in emergency repairs and installations.',
        skills: ['Emergency Repairs', 'Pipe Installation', 'Water Heater', 'Drain Cleaning'],
        services: [services[0].id], // Plumbing service
        experience: 10,
        hourlyRate: 75,
        availability: {
          monday: { available: true, startTime: '08:00', endTime: '18:00' },
          tuesday: { available: true, startTime: '08:00', endTime: '18:00' },
          wednesday: { available: true, startTime: '08:00', endTime: '18:00' },
          thursday: { available: true, startTime: '08:00', endTime: '18:00' },
          friday: { available: true, startTime: '08:00', endTime: '18:00' },
          saturday: { available: true, startTime: '09:00', endTime: '15:00' },
          sunday: { available: false }
        },
        serviceArea: {
          cities: ['New York', 'Brooklyn', 'Queens'],
          radius: 25
        },
        portfolio: [
          {
            title: 'Emergency Pipe Repair',
            description: 'Fixed burst pipe in commercial building',
            images: ['pipe1.jpg', 'pipe2.jpg']
          }
        ],
        certifications: ['Licensed Plumber', 'EPA Certified'],
        businessInfo: {
          businessName: "Bob's Plumbing Services",
          license: 'PL-12345',
          insurance: 'Fully Insured'
        },
        isActive: true,
        isVerified: true,
        jobsCompleted: 150,
        totalEarnings: 75000,
        averageRating: 4.8,
        totalReviews: 45
      }
    }),
    prisma.worker.create({
      data: {
        userId: users[4].id, // Sarah Davis
        bio: 'Certified electrician specializing in residential and commercial installations.',
        skills: ['Electrical Installation', 'Wiring', 'Panel Upgrades', 'Lighting'],
        services: [services[1].id], // Electrical service
        experience: 8,
        hourlyRate: 85,
        availability: {
          monday: { available: true, startTime: '07:00', endTime: '19:00' },
          tuesday: { available: true, startTime: '07:00', endTime: '19:00' },
          wednesday: { available: true, startTime: '07:00', endTime: '19:00' },
          thursday: { available: true, startTime: '07:00', endTime: '19:00' },
          friday: { available: true, startTime: '07:00', endTime: '19:00' },
          saturday: { available: false },
          sunday: { available: false }
        },
        serviceArea: {
          cities: ['Boston', 'Cambridge', 'Somerville'],
          radius: 30
        },
        portfolio: [
          {
            title: 'Complete Home Rewiring',
            description: 'Rewired entire house with modern electrical system',
            images: ['rewire1.jpg', 'rewire2.jpg']
          }
        ],
        certifications: ['Master Electrician', 'OSHA Certified'],
        businessInfo: {
          businessName: 'Davis Electrical Solutions',
          license: 'EL-67890',
          insurance: 'Fully Insured'
        },
        isActive: true,
        isVerified: true,
        jobsCompleted: 120,
        totalEarnings: 95000,
        averageRating: 4.9,
        totalReviews: 38
      }
    }),
    prisma.worker.create({
      data: {
        userId: users[5].id, // Tom Wilson
        bio: 'HVAC technician with expertise in installation, maintenance, and repair of heating and cooling systems.',
        skills: ['HVAC Installation', 'Maintenance', 'Repair', 'Duct Cleaning'],
        services: [services[2].id], // HVAC service
        experience: 12,
        hourlyRate: 90,
        availability: {
          monday: { available: true, startTime: '08:00', endTime: '17:00' },
          tuesday: { available: true, startTime: '08:00', endTime: '17:00' },
          wednesday: { available: true, startTime: '08:00', endTime: '17:00' },
          thursday: { available: true, startTime: '08:00', endTime: '17:00' },
          friday: { available: true, startTime: '08:00', endTime: '17:00' },
          saturday: { available: true, startTime: '09:00', endTime: '14:00' },
          sunday: { available: false }
        },
        serviceArea: {
          cities: ['Chicago', 'Evanston', 'Oak Park'],
          radius: 35
        },
        portfolio: [
          {
            title: 'Commercial HVAC Installation',
            description: 'Installed new HVAC system in office building',
            images: ['hvac1.jpg', 'hvac2.jpg']
          }
        ],
        certifications: ['HVAC Certified', 'EPA Section 608'],
        businessInfo: {
          businessName: "Wilson's HVAC Services",
          license: 'HV-24680',
          insurance: 'Fully Insured'
        },
        isActive: true,
        isVerified: true,
        jobsCompleted: 200,
        totalEarnings: 120000,
        averageRating: 4.7,
        totalReviews: 52
      }
    }),
    prisma.worker.create({
      data: {
        userId: users[6].id, // Lisa Brown
        bio: 'Professional locksmith providing 24/7 emergency lockout services and security solutions.',
        skills: ['Emergency Lockout', 'Lock Installation', 'Key Duplication', 'Security Systems'],
        services: [services[3].id], // Locksmith service
        experience: 6,
        hourlyRate: 65,
        availability: {
          monday: { available: true, startTime: '00:00', endTime: '23:59' },
          tuesday: { available: true, startTime: '00:00', endTime: '23:59' },
          wednesday: { available: true, startTime: '00:00', endTime: '23:59' },
          thursday: { available: true, startTime: '00:00', endTime: '23:59' },
          friday: { available: true, startTime: '00:00', endTime: '23:59' },
          saturday: { available: true, startTime: '00:00', endTime: '23:59' },
          sunday: { available: true, startTime: '00:00', endTime: '23:59' }
        },
        serviceArea: {
          cities: ['Los Angeles', 'Beverly Hills', 'Santa Monica'],
          radius: 40
        },
        portfolio: [
          {
            title: 'Emergency Lockout Service',
            description: 'Helped family locked out of their home at 2am',
            images: ['lockout1.jpg']
          }
        ],
        certifications: ['Certified Locksmith', 'Security Specialist'],
        businessInfo: {
          businessName: 'Brown Locksmith & Security',
          license: 'LK-13579',
          insurance: 'Fully Insured'
        },
        isActive: true,
        isVerified: true,
        jobsCompleted: 300,
        totalEarnings: 60000,
        averageRating: 4.9,
        totalReviews: 78
      }
    })
  ]);

  console.log('✅ Created worker profiles');

  // Create reservations
  const reservations = await Promise.all([
    prisma.reservation.create({
      data: {
        userId: users[0].id, // John Doe
        workerId: users[3].id, // Bob Johnson
        serviceId: services[0].id, // Plumbing
        date: new Date('2024-12-25'),
        time: '14:00',
        duration: 120,
        status: 'COMPLETED',
        location: {
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001'
        },
        description: 'Burst pipe in kitchen needs immediate repair',
        emergency: true,
        estimatedPrice: 150,
        actualPrice: 175,
        startTime: new Date('2024-12-25T14:00:00Z'),
        completedAt: new Date('2024-12-25T16:30:00Z')
      }
    }),
    prisma.reservation.create({
      data: {
        userId: users[1].id, // Jane Smith
        workerId: users[4].id, // Sarah Davis
        serviceId: services[1].id, // Electrical
        date: new Date('2024-12-26'),
        time: '10:00',
        duration: 180,
        status: 'COMPLETED',
        location: {
          address: '456 Oak Ave',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101'
        },
        description: 'Install new outlets in living room',
        emergency: false,
        estimatedPrice: 200,
        actualPrice: 200,
        startTime: new Date('2024-12-26T10:00:00Z'),
        completedAt: new Date('2024-12-26T13:00:00Z')
      }
    }),
    prisma.reservation.create({
      data: {
        userId: users[2].id, // Mike Wilson
        workerId: users[5].id, // Tom Wilson
        serviceId: services[2].id, // HVAC
        date: new Date('2024-12-27'),
        time: '09:00',
        duration: 90,
        status: 'ACCEPTED',
        location: {
          address: '789 Pine Rd',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601'
        },
        description: 'Annual HVAC maintenance check',
        emergency: false,
        estimatedPrice: 120,
        startTime: null,
        completedAt: null
      }
    }),
    prisma.reservation.create({
      data: {
        userId: users[0].id, // John Doe
        workerId: users[6].id, // Lisa Brown
        serviceId: services[3].id, // Locksmith
        date: new Date('2024-12-28'),
        time: '15:00',
        duration: 60,
        status: 'PENDING',
        location: {
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001'
        },
        description: 'Locked out of house - need emergency service',
        emergency: true,
        estimatedPrice: 150,
        startTime: null,
        completedAt: null
      }
    })
  ]);

  console.log('✅ Created reservations');

  // Create reviews
  await Promise.all([
    prisma.review.create({
      data: {
        userId: users[0].id, // John Doe
        workerId: users[3].id, // Bob Johnson
        reservationId: reservations[0].id,
        rating: 5,
        comment: 'Excellent service! Bob arrived quickly and fixed the burst pipe professionally. Highly recommend!',
        aspects: {
          professionalism: 5,
          quality: 5,
          timeliness: 5,
          communication: 5,
          value: 5
        },
        wouldHireAgain: true,
        isVerified: true
      }
    }),
    prisma.review.create({
      data: {
        userId: users[1].id, // Jane Smith
        workerId: users[4].id, // Sarah Davis
        reservationId: reservations[1].id,
        rating: 4,
        comment: 'Great work! Sarah installed the outlets perfectly and cleaned up afterwards. Very professional.',
        aspects: {
          professionalism: 4,
          quality: 4,
          timeliness: 4,
          communication: 5,
          value: 4
        },
        wouldHireAgain: true,
        isVerified: true
      }
    })
  ]);

  console.log('✅ Created reviews');

  // Create tracking entries
  await Promise.all([
    prisma.tracking.create({
      data: {
        status: 'PENDING',
        note: 'Reservation created',
        reservationId: reservations[0].id
      }
    }),
    prisma.tracking.create({
      data: {
        status: 'ACCEPTED',
        note: 'Worker accepted the job',
        reservationId: reservations[0].id
      }
    }),
    prisma.tracking.create({
      data: {
        status: 'IN_PROGRESS',
        note: 'Worker arrived and started work',
        reservationId: reservations[0].id
      }
    }),
    prisma.tracking.create({
      data: {
        status: 'COMPLETED',
        note: 'Job completed successfully',
        reservationId: reservations[0].id
      }
    })
  ]);

  console.log('✅ Created tracking entries');

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Services: ${services.length}`);
  console.log(`   Users: ${users.length}`);
  console.log(`   Workers: ${workers.length}`);
  console.log(`   Reservations: ${reservations.length}`);
  console.log(`   Reviews: 2`);
  console.log(`   Tracking entries: 4`);
  
  console.log('\n🔑 Test Accounts:');
  console.log('   Regular User: john.doe@example.com / password123');
  console.log('   Worker: bob.plumber@example.com / password123');
  console.log('   Admin: admin@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
