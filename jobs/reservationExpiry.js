const { prisma } = require('../config/database');
const socketService = require('../services/socketService');
const { sendPushNotification } = require('../services/pushNotificationService');

const EXPIRY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const EXPIRY_REASON = 'Expiré automatiquement — aucune réponse du professionnel sous 24h';

// Finds PENDING reservations older than 24h, marks them EXPIRED, and notifies
// both parties. Runs on a schedule (see server.js) rather than per-request,
// since there is no other trigger for a reservation that nobody ever responds to.
const runExpirySweep = async () => {
  const cutoff = new Date(Date.now() - EXPIRY_WINDOW_MS);

  const expiring = await prisma.reservation.findMany({
    where: { status: 'PENDING', createdAt: { lte: cutoff } },
    select: { id: true, userId: true, workerId: true }
  });

  if (expiring.length === 0) return;

  const ids = expiring.map((r) => r.id);

  await prisma.reservation.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'EXPIRED',
      cancelledAt: new Date(),
      cancellationReason: EXPIRY_REASON
    }
  });

  for (const { id, userId, workerId } of expiring) {
    try {
      const eventPayload = {
        reservationId: id,
        newStatus: 'EXPIRED',
        updatedAt: new Date()
      };
      socketService.emitToUser(userId, 'reservation_status_changed', eventPayload);
      socketService.emitToWorker(workerId, 'reservation_status_changed', eventPayload);

      await prisma.notification.createMany({
        data: [
          {
            userId,
            title: 'Réservation expirée',
            message: 'Votre réservation a expiré car le professionnel n\'a pas répondu sous 24h.',
            type: 'RESERVATION_EXPIRED',
            data: JSON.stringify({ reservationId: id }),
            isRead: false
          },
          {
            userId: workerId,
            title: 'Réservation expirée',
            message: 'Une réservation a expiré faute de réponse sous 24h.',
            type: 'RESERVATION_EXPIRED',
            data: JSON.stringify({ reservationId: id }),
            isRead: false
          }
        ]
      });

      const [user, worker] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { expoPushToken: true } }),
        prisma.user.findUnique({ where: { id: workerId }, select: { expoPushToken: true } })
      ]);

      if (user?.expoPushToken) {
        await sendPushNotification(
          user.expoPushToken,
          'Réservation expirée',
          'Votre réservation a expiré car le professionnel n\'a pas répondu sous 24h.',
          { reservationId: id }
        );
      }
      if (worker?.expoPushToken) {
        await sendPushNotification(
          worker.expoPushToken,
          'Réservation expirée',
          'Une réservation a expiré faute de réponse sous 24h.',
          { reservationId: id }
        );
      }
    } catch (error) {
      console.error(`Failed to notify parties for expired reservation ${id}:`, error);
    }
  }

  console.log(`[reservationExpiry] Expired ${expiring.length} pending reservation(s) older than 24h.`);
};

module.exports = { runExpirySweep };
