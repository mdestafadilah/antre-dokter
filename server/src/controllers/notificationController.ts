import { Context } from 'hono';
import { Op } from 'sequelize';
import { Notification, EmergencyClosure, User } from '../models/index.js';

// Removed complex auto-reschedule functionality
// Emergency closure now just notifies patients to book manually

export const getPatientNotifications = async (c: Context) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    const { page = '1', limit = '20', unreadOnly = 'false' } = c.req.query();

    const whereClause: any = { userId };
    if (unreadOnly === 'true') {
      whereClause.isRead = false;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const notifications = await Notification.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const unreadCount = await Notification.count({
      where: { userId, isRead: false }
    });

    return c.json({
      success: true,
      data: {
        notifications: notifications.rows,
        unreadCount,
        pagination: {
          total: notifications.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(notifications.count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get patient notifications error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const markNotificationAsRead = async (c: Context) => {
  try {
    const notificationId = c.req.param('notificationId');
    const user = c.get('user');
    const userId = user.id;

    const notification = await Notification.findOne({
      where: { id: notificationId, userId }
    });

    if (!notification) {
      return c.json({
        success: false,
        message: 'Notifikasi tidak ditemukan'
      }, 404);
    }

    await notification.update({ isRead: true });

    return c.json({
      success: true,
      message: 'Notifikasi berhasil ditandai sebagai dibaca'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const markAllNotificationsAsRead = async (c: Context) => {
  try {
    const user = c.get('user');
    const userId = user.id;

    await Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );

    return c.json({
      success: true,
      message: 'Semua notifikasi berhasil ditandai sebagai dibaca'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

// Removed complex reschedule request functionality
// Patients will book new appointments manually

export const createEmergencyNotifications = async (emergencyClosureId: number, affectedQueues: any[]) => {
  try {
    const emergencyClosure = await EmergencyClosure.findByPk(emergencyClosureId, {
      include: [{ model: User, as: 'creator', attributes: ['fullName'] }]
    });

    if (!emergencyClosure) return false;

    const notifications = [];

    for (const queue of affectedQueues) {
      const message = `Maaf, praktik ditutup darurat pada ${new Date(queue.appointmentDate).toLocaleDateString('id-ID')}. Alasan: ${emergencyClosure.reason}. Silakan buat jadwal baru melalui aplikasi atau hubungi admin untuk bantuan.`;
      
      notifications.push({
        userId: queue.userId,
        type: 'emergency_closure',
        title: 'Praktik Ditutup Darurat',
        message: message,
        actionRequired: false,
        actionData: {
          emergencyClosureId: emergencyClosureId,
          originalQueueId: queue.id,
          originalDate: queue.appointmentDate,
          originalQueueNumber: queue.queueNumber
        },
        relatedId: queue.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    }

    // Bulk create notifications
    if (notifications.length > 0) {
      await Notification.bulkCreate(notifications as any);
    }

    // Update emergency closure to mark notifications as sent
    await emergencyClosure.update({ notificationSent: true });

    return true;
  } catch (error) {
    console.error('Create emergency notifications error:', error);
    return false;
  }
};
