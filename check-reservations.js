const { prisma } = require('./config/database');

async function checkReservations() {
  try {
    console.log('Checking all reservations in database...');

    const reservations = await prisma.reservation.findMany({
      select: {
        id: true,
        userId: true,
        workerId: true,
        serviceId: true,
        status: true,
        date: true,
        time: true,
        description: true
      }
    });

    console.log(`Total reservations: ${reservations.length}`);
    console.log('\nReservations:');
    reservations.forEach(r => {
      console.log(`ID: ${r.id}, userId: ${r.userId}, workerId: ${r.workerId}, status: ${r.status}, date: ${r.date}`);
    });

    // Check worker table
    const workers = await prisma.worker.findMany({
      select: {
        id: true,
        userId: true
      }
    });

    console.log('\nWorkers:');
    workers.forEach(w => {
      console.log(`Worker ID: ${w.id}, User ID: ${w.userId}`);
    });

  } catch (error) {
    console.error('Error checking reservations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReservations();
