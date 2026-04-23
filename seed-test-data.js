const { prisma } = require('./config/database');

async function seedTestData() {
  try {
    console.log('Starting to seed test data...');

    // Get the worker with userId=1 (from logs we saw worker.id=3, worker.userId=1)
    const worker = await prisma.worker.findFirst({
      where: { userId: 1 }
    });

    if (!worker) {
      console.error('Worker with userId=1 not found');
      return;
    }

    console.log('Found worker:', worker);

    // Get a user to create reservation for
    const user = await prisma.user.findFirst({
      where: { id: { not: 1 } } // Get a different user
    });

    if (!user) {
      console.error('No other user found');
      return;
    }

    console.log('Found user:', user);

    // Get a service
    const service = await prisma.service.findFirst();

    if (!service) {
      console.error('No service found');
      return;
    }

    console.log('Found service:', service);

    // Create a dummy reservation with ACCEPTED status
    const reservation = await prisma.reservation.create({
      data: {
        userId: user.id,
        workerId: worker.id,
        serviceId: service.id,
        date: new Date(),
        time: '10:00',
        duration: 60,
        location: { address: 'Test Location' },
        description: 'Test reservation for messaging',
        emergency: false,
        images: [],
        estimatedPrice: 100,
        status: 'ACCEPTED'
      }
    });

    console.log('Created reservation:', reservation);

    // Create messages for the reservation
    const message1 = await prisma.message.create({
      data: {
        reservationId: reservation.id,
        senderId: worker.userId,
        receiverId: user.id,
        content: 'Bonjour ! J\'ai accepté votre demande. N\'hésitez pas à me contacter si vous avez des questions.',
        type: 'text'
      }
    });

    const message2 = await prisma.message.create({
      data: {
        reservationId: reservation.id,
        senderId: user.id,
        receiverId: worker.userId,
        content: 'Merci d\'avoir accepté ma demande. Je suis disponible pour échanger sur les détails.',
        type: 'text'
      }
    });

    console.log('Created messages:', message1, message2);

    console.log('Test data seeded successfully!');
  } catch (error) {
    console.error('Error seeding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
