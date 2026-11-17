const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

async function markNotificationAsRead(id, userId) {
  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    const error = new Error('Notification not found');
    error.status = 404;
    throw error;
  }

  if (notification.userId !== userId) {
    const error = new Error('Access denied');
    error.status = 403;
    throw error;
  }

  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

async function markAllNotificationsAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

module.exports = {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
