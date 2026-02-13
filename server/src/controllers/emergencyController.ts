import { Context } from 'hono';
import { Queue, User, EmergencyClosure } from '../models/index.js';
import { Op } from 'sequelize';
import { logActivity } from '../utils/activityLogger.js';
import { createEmergencyNotifications } from './notificationController.js';
import { io } from '../index.js';

export const createEmergencyClosure = async (c: Context) => {
  try {
    const { closureDate, reason } = await c.req.json();
    const adminUser = c.get('user');
    const adminId = adminUser.id;

    if (!closureDate || !reason) {
      return c.json({
        success: false,
        message: 'Tanggal penutupan dan alasan harus diisi'
      }, 400);
    }

    // Check if there's already an active emergency closure for this date
    const existingClosure = await EmergencyClosure.findOne({
      where: {
        closureDate,
        isActive: true
      }
    });

    if (existingClosure) {
      return c.json({
        success: false,
        message: 'Sudah ada penutupan darurat untuk tanggal tersebut'
      }, 400);
    }

    // Get all active queues for the closure date
    const affectedQueues = await Queue.findAll({
      where: {
        appointmentDate: closureDate,
        status: { [Op.in]: ['waiting', 'in_service'] } as any
      },
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }]
    });

    // Create emergency closure record
    const emergencyClosure = await EmergencyClosure.create({
      closureDate,
      reason,
      affectedQueuesCount: affectedQueues.length,
      createdBy: adminId
    });

    // Update all affected queues to 'emergency_cancelled' status
    const queueIds = affectedQueues.map(q => q.id);
    if (queueIds.length > 0) {
      await Queue.update(
        { 
          status: 'emergency_cancelled',
          notes: `Praktik ditutup darurat: ${reason}`
        },
        { where: { id: queueIds } }
      );
    }

    // Log activity for each affected queue
    for (const queue of affectedQueues) {
      await logActivity({
        type: 'queue_cancelled', // Mapped to existing type
        title: 'Penutupan praktik darurat',
        description: `Antrian ${(queue as any).patient.fullName} (No. ${queue.queueNumber}) dibatalkan karena penutupan darurat: ${reason}`,
        userId: queue.userId,
        queueId: queue.id,
        metadata: {
          queueNumber: queue.queueNumber,
          patientName: (queue as any).patient.fullName,
          closureReason: reason,
          emergencyClosureId: emergencyClosure.id,
          originalStatus: queue.status
        }
      });
    }

    // Log admin activity
    await logActivity({
      type: 'settings_updated', // Mapped to existing type
      title: 'Admin membuat penutupan darurat',
      description: `Praktik ditutup darurat pada ${closureDate}: ${reason}. ${affectedQueues.length} antrian terpengaruh`,
      userId: adminId,
      metadata: {
        closureDate,
        reason,
        affectedQueuesCount: affectedQueues.length,
        emergencyClosureId: emergencyClosure.id
      }
    });

    // Create notifications for affected patients
    await createEmergencyNotifications(emergencyClosure.id, affectedQueues);

    // Emit socket event for real-time notifications
    if (io) {
      affectedQueues.forEach(queue => {
        io.to(`user_${queue.userId}`).emit('emergency_closure', {
          type: 'emergency_closure',
          title: 'Praktik Ditutup Darurat',
          message: `Praktik ditutup darurat pada ${new Date(closureDate).toLocaleDateString('id-ID')}. Alasan: ${reason}`,
          closureDate,
          reason,
          queueNumber: queue.queueNumber
        });
      });
    }

    return c.json({
      success: true,
      message: 'Penutupan darurat berhasil dibuat dan notifikasi telah dikirim',
      data: {
        emergencyClosure: {
          ...emergencyClosure.dataValues,
          affectedQueues: affectedQueues.map(q => ({
            id: q.id,
            queueNumber: q.queueNumber,
            patientName: (q as any).patient.fullName,
            phoneNumber: (q as any).patient.phoneNumber
          }))
        }
      }
    }, 201);
  } catch (error) {
    console.error('Create emergency closure error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getEmergencyClosures = async (c: Context) => {
  try {
    const { page = '1', limit = '10', isActive } = c.req.query();
    
    const whereClause: any = {};
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const closures = await EmergencyClosure.findAndCountAll({
      where: whereClause,
      include: [{ model: User, as: 'creator', attributes: ['fullName'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return c.json({
      success: true,
      data: {
        closures: closures.rows,
        pagination: {
          total: closures.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(closures.count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get emergency closures error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const checkEmergencyClosure = async (c: Context) => {
  try {
    const { date } = c.req.query();
    
    if (!date) {
      return c.json({
        success: false,
        message: 'Parameter tanggal diperlukan'
      }, 400);
    }

    const emergencyClosure = await EmergencyClosure.findOne({
      where: {
        closureDate: date,
        isActive: true
      },
      include: [{ model: User, as: 'creator', attributes: ['fullName'] }]
    });

    return c.json({
      success: true,
      data: {
        hasEmergencyClosure: !!emergencyClosure,
        emergencyClosure
      }
    });
  } catch (error) {
    console.error('Check emergency closure error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const rescheduleAffectedQueues = async (c: Context) => {
  try {
    const { emergencyClosureId, newDate } = await c.req.json();
    const adminUser = c.get('user');
    const adminId = adminUser.id;

    if (!emergencyClosureId || !newDate) {
      return c.json({
        success: false,
        message: 'ID penutupan darurat dan tanggal baru harus diisi'
      }, 400);
    }

    const emergencyClosure = await EmergencyClosure.findByPk(emergencyClosureId);
    if (!emergencyClosure) {
      return c.json({
        success: false,
        message: 'Penutupan darurat tidak ditemukan'
      }, 404);
    }

    // Get all emergency cancelled queues for this closure
    const affectedQueues = await Queue.findAll({
      where: {
        appointmentDate: emergencyClosure.closureDate,
        status: 'emergency_cancelled'
      },
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }]
    });

    let rescheduledCount = 0;
    
    for (const queue of affectedQueues) {
      // Check if patient already has a queue on the new date
      const existingQueue = await Queue.findOne({
        where: {
          userId: queue.userId,
          appointmentDate: newDate,
          status: { [Op.not]: 'cancelled' } as any
        }
      });

      if (!existingQueue) {
        // Get next queue number for the new date
        const queueCount = await Queue.count({
          where: {
            appointmentDate: newDate,
            status: { [Op.not]: 'cancelled' } as any
          }
        });

        // Create new queue for the new date
        await Queue.create({
          userId: queue.userId,
          appointmentDate: newDate,
          queueNumber: queueCount + 1,
          notes: `Dijadwal ulang dari ${emergencyClosure.closureDate} karena penutupan darurat`,
          status: 'waiting'
        });

        // Log rescheduling activity
        await logActivity({
          type: 'queue_created', // Mapped to existing type
          title: 'Antrian dijadwal ulang',
          description: `Antrian ${(queue as any).patient.fullName} dijadwal ulang dari ${emergencyClosure.closureDate} ke ${newDate}`,
          userId: queue.userId,
          queueId: queue.id,
          metadata: {
            originalDate: emergencyClosure.closureDate,
            newDate,
            queueNumber: queue.queueNumber,
            patientName: (queue as any).patient.fullName,
            rescheduledBy: adminId
          }
        });

        rescheduledCount++;
      }
    }

    // Update emergency closure record
    await emergencyClosure.update({
      reschedulingOffered: true
    });

    return c.json({
      success: true,
      message: `${rescheduledCount} antrian berhasil dijadwal ulang`,
      data: {
        rescheduledCount,
        totalAffected: affectedQueues.length,
        newDate
      }
    });
  } catch (error) {
    console.error('Reschedule affected queues error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const deactivateEmergencyClosure = async (c: Context) => {
  try {
    const emergencyClosureId = c.req.param('emergencyClosureId');
    const adminUser = c.get('user');
    const adminId = adminUser.id;

    const emergencyClosure = await EmergencyClosure.findByPk(emergencyClosureId);
    if (!emergencyClosure) {
      return c.json({
        success: false,
        message: 'Penutupan darurat tidak ditemukan'
      }, 404);
    }

    await emergencyClosure.update({ isActive: false });

    await logActivity({
      type: 'settings_updated', // Mapped to existing
      title: 'Penutupan darurat dinonaktifkan',
      description: `Penutupan darurat pada ${emergencyClosure.closureDate} dinonaktifkan`,
      userId: adminId,
      metadata: {
        emergencyClosureId,
        closureDate: emergencyClosure.closureDate,
        deactivatedBy: adminId
      }
    });

    return c.json({
      success: true,
      message: 'Penutupan darurat berhasil dinonaktifkan'
    });
  } catch (error) {
    console.error('Deactivate emergency closure error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};
