const { prisma } = require('./config/database');

async function seedConversation() {
  try {
    console.log('Starting to seed conversation test data...');

    // Get the worker with userId=1 (worker.id=3)
    const worker = await prisma.worker.findFirst({
      where: { userId: 1 }
    });

    if (!worker) {
      console.error('Worker with userId=1 not found');
      return;
    }

    console.log('Found worker:', worker);

    // Get a different user to be the client
    const user = await prisma.user.findFirst({
      where: { id: { not: 1 } }
    });

    if (!user) {
      console.error('No other user found');
      return;
    }

    console.log('Found client user:', user);

    // Get a service
    const service = await prisma.service.findFirst();

    if (!service) {
      console.error('No service found');
      return;
    }

    console.log('Found service:', service);

    // Create a reservation with worker as worker and user as client
    const reservation = await prisma.reservation.create({
      data: {
        userId: user.id,      // Client is user.id
        workerId: worker.id,  // Worker is worker.id (3)
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

    // Create messages - worker to client
    const message1 = await prisma.message.create({
      data: {
        reservationId: reservation.id,
        senderId: worker.userId,    // Worker sending
        receiverId: user.id,         // To client
        content: 'Bonjour ! J\'ai accepté votre demande. N\'hésitez pas à me contacter si vous avez des questions.',
        type: 'text'
      }
    });

    // Client to worker
    const message2 = await prisma.message.create({
      data: {
        reservationId: reservation.id,
        senderId: user.id,            // Client sending
        receiverId: worker.userId,    // To worker
        content: 'Merci d\'avoir accepté ma demande. Je suis disponible pour échanger sur les détails.',
        type: 'text'
      }
    });

    console.log('Created messages:', message1, message2);

    console.log('Conversation test data seeded successfully!');
    console.log('Reservation ID:', reservation.id);
    console.log('Worker ID:', worker.id, 'User ID:', worker.userId);
    console.log('Client ID:', user.id);
  } catch (error) {
    console.error('Error seeding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedConversation();
