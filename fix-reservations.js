const { prisma } = require('./config/database');

async function fixReservations() {
  try {
    console.log('Fixing reservations to use correct worker table ID...');

    // Get the worker with userId=1
    const worker = await prisma.worker.findFirst({
      where: { userId: 1 }
    });

    if (!worker) {
      console.error('Worker with userId=1 not found');
      return;
    }

    console.log('Found worker:', worker);

    // Find all reservations with workerId=1 (incorrect - this is user ID)
    const incorrectReservations = await prisma.reservation.findMany({
      where: { workerId: 1 }
    });

    console.log('Found reservations with incorrect workerId:', incorrectReservations.length);

    // Update them to use the correct worker table ID
    for (const reservation of incorrectReservations) {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { workerId: worker.id }
      });
      console.log(`Updated reservation ${reservation.id}: workerId 1 -> ${worker.id}`);
    }

    console.log('All reservations fixed successfully!');
  } catch (error) {
    console.error('Error fixing reservations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixReservations();
