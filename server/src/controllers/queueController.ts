import { Context } from 'hono';
import { Queue, User, PracticeSettings, EmergencyClosure } from '../models/index.js';
import { Op } from 'sequelize';
import { logActivity } from '../utils/activityLogger.js';
import { io } from '../index.js';

// Helper function to get current date in WITA timezone
const getWitaDateString = () => {
  const now = new Date();
  const witaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
  return witaTime.toISOString().split('T')[0];
};

export const getAvailableSlots = async (c: Context) => {
  try {
    const { date } = c.req.query();
    
    if (!date) {
      return c.json({
        success: false,
        message: 'Parameter tanggal diperlukan'
      }, 400);
    }

    const settings = await PracticeSettings.findOne({ where: { isActive: true } });
    if (!settings) {
      return c.json({
        success: false,
        message: 'Pengaturan praktik belum dikonfigurasi'
      }, 500);
    }

    const requestDate = new Date(date);
    const dayOfWeek = requestDate.getDay();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    // Check for emergency closure (handle gracefully if table doesn't exist)
    let emergencyClosure = null;
    try {
      emergencyClosure = await EmergencyClosure.findOne({
        where: {
          closureDate: date,
          isActive: true
        },
        include: [{ model: User, as: 'creator', attributes: ['fullName'] }]
      });
    } catch (error: any) {
      console.log('Emergency closure table not available yet:', error.message);
    }

    if (emergencyClosure) {
      // Get affected queues count
      let affectedQueuesCount = 0;
      try {
        affectedQueuesCount = await Queue.count({
          where: {
            appointmentDate: date,
            status: 'emergency_cancelled'
          }
        });
      } catch (error: any) {
        console.log('Could not count emergency cancelled queues:', error.message);
      }

      return c.json({
        success: true,
        data: {
          date,
          isOperatingDay: true,
          isEmergencyClosure: true,
          emergencyClosure: {
            reason: emergencyClosure.reason,
            createdBy: (emergencyClosure as any).creator.fullName,
            createdAt: emergencyClosure.createdAt,
            affectedQueuesCount
          },
          maxSlots: settings.maxSlotsPerDay,
          availableSlots: 0,
          totalBooked: affectedQueuesCount,
          operatingHours: settings.operatingHours,
          operatingDays: settings.operatingDays,
          message: `Praktik ditutup darurat: ${emergencyClosure.reason}`
        }
      });
    }

    if (!settings.operatingDays.includes(dayOfWeek)) {
      const operatingDayNames = settings.operatingDays.map(day => dayNames[day]);
      
      return c.json({
        success: true,
        data: {
          date,
          isOperatingDay: false,
          isEmergencyClosure: false,
          dayOfWeek: dayNames[dayOfWeek],
          operatingDays: settings.operatingDays,
          operatingDayNames,
          operatingHours: settings.operatingHours,
          maxSlots: settings.maxSlotsPerDay,
          availableSlots: 0,
          totalBooked: 0,
          message: `Praktik tidak beroperasi pada hari ${dayNames[dayOfWeek]}. Hari operasional: ${operatingDayNames.join(', ')}`
        }
      });
    }

    // Get all booked queues for the date
    const bookedQueues = await Queue.findAll({
      where: {
        appointmentDate: date,
        status: { [Op.not]: 'cancelled' } as any
      },
      attributes: ['queueNumber'],
      order: [['queueNumber', 'ASC']]
    });

    const totalBooked = bookedQueues.length;
    const availableSlots = settings.maxSlotsPerDay - totalBooked;

    return c.json({
      success: true,
      data: {
        date,
        isOperatingDay: true,
        isEmergencyClosure: false,
        availableSlots: Math.max(0, availableSlots),
        maxSlots: settings.maxSlotsPerDay,
        totalBooked,
        operatingHours: settings.operatingHours,
        operatingDays: settings.operatingDays
      }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const bookQueue = async (c: Context) => {
  try {
    const { appointmentDate } = await c.req.json();
    const user = c.get('user');
    const userId = user.id;

    const existingQueue = await Queue.findOne({
      where: {
        userId,
        appointmentDate,
        status: { [Op.not]: 'cancelled' } as any
      }
    });

    if (existingQueue) {
      return c.json({
        success: false,
        message: 'Anda sudah memiliki antrian pada tanggal tersebut'
      }, 400);
    }

    const settings = await PracticeSettings.findOne({ where: { isActive: true } });
    if (!settings) {
         return c.json({
        success: false,
        message: 'Pengaturan praktik belum dikonfigurasi'
      }, 500);
    }

    const queueCount = await Queue.count({
      where: {
        appointmentDate,
        status: { [Op.not]: 'cancelled' } as any
      }
    });

    if (queueCount >= settings.maxSlotsPerDay) {
      return c.json({
        success: false,
        message: 'Slot antrian untuk tanggal tersebut sudah penuh'
      }, 400);
    }

    const queueNumber = queueCount + 1;

    const queue = await Queue.create({
      userId,
      appointmentDate,
      queueNumber,
      status: 'waiting'
    });

    const queueWithUser = await Queue.findByPk(queue.id, {
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }]
    });

    if (!queueWithUser) throw new Error('Queue not found after creation');

    // Log activity
    await logActivity({
      type: 'queue_created',
      title: 'Antrian baru dibuat',
      description: `${(queueWithUser as any).patient.fullName} membuat antrian nomor ${queueWithUser.queueNumber}`,
      userId: queueWithUser.userId,
      queueId: queueWithUser.id,
      metadata: {
        queueNumber: queueWithUser.queueNumber,
        appointmentDate: queueWithUser.appointmentDate,
        patientName: (queueWithUser as any).patient.fullName
      }
    });

    return c.json({
      success: true,
      message: 'Antrian berhasil dibuat',
      data: { queue: queueWithUser }
    }, 201);
  } catch (error) {
    console.error('Book queue error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getMyQueues = async (c: Context) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    const queues = await Queue.findAll({
      where: { userId },
      order: [['appointmentDate', 'DESC'], ['queueNumber', 'DESC']],
      limit: 20
    });

    return c.json({
      success: true,
      data: { queues }
    });
  } catch (error) {
    console.error('Get my queues error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getCurrentQueue = async (c: Context) => {
  try {
    const today = getWitaDateString();
    
    const currentQueue = await Queue.findOne({
      where: {
        appointmentDate: today,
        status: 'in_service'
      },
      include: [{ model: User, as: 'patient', attributes: ['fullName'] }]
    });

    const waitingQueues = await Queue.findAll({
      where: {
        appointmentDate: today,
        status: 'waiting'
      },
      include: [{ model: User, as: 'patient', attributes: ['fullName'] }],
      order: [['queueNumber', 'ASC']]
    });

    return c.json({
      success: true,
      data: {
        currentQueue,
        waitingQueues,
        totalWaiting: waitingQueues.length
      }
    });
  } catch (error) {
    console.error('Get current queue error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const cancelQueue = async (c: Context) => {
  try {
    const queueId = c.req.param('queueId');
    const user = c.get('user');
    const userId = user.id;

    const queue = await Queue.findOne({
      where: { id: queueId, userId }
    });

    if (!queue) {
      return c.json({
        success: false,
        message: 'Antrian tidak ditemukan'
      }, 404);
    }

    if (queue.status !== 'waiting') {
      return c.json({
        success: false,
        message: 'Antrian tidak dapat dibatalkan'
      }, 400);
    }

    // Check if it's still possible to cancel (e.g., not on the same day or past operating hours)
    const today = getWitaDateString();
    const appointmentDate = queue.appointmentDate;
    
    // Allow cancellation if appointment is not today, or if it's today but still early
    const now = new Date();
    const currentHour = now.getHours();
    
    if (appointmentDate === today && currentHour >= 8) { // Assuming practice starts at 8 AM
      return c.json({
        success: false,
        message: 'Antrian tidak dapat dibatalkan pada hari yang sama setelah jam praktik dimulai'
      }, 400);
    }

    await queue.update({ status: 'cancelled' });

    const queueWithUser = await Queue.findByPk(queue.id, {
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }]
    });

    if (!queueWithUser) throw new Error('Queue not found after update');

    // Log activity
    await logActivity({
      type: 'queue_cancelled',
      title: 'Antrian dibatalkan',
      description: `${(queueWithUser as any).patient.fullName} membatalkan antrian nomor ${queueWithUser.queueNumber}`,
      userId: queueWithUser.userId,
      queueId: queueWithUser.id,
      metadata: {
        queueNumber: queueWithUser.queueNumber,
        patientName: (queueWithUser as any).patient.fullName,
        appointmentDate: queueWithUser.appointmentDate,
        cancelledAt: new Date()
      }
    });

    return c.json({
      success: true,
      message: 'Antrian berhasil dibatalkan'
    });
  } catch (error) {
    console.error('Cancel queue error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const callNextQueue = async (c: Context) => {
  try {
    const today = getWitaDateString();
    
    // Check if there's already a queue in service
    const currentQueue = await Queue.findOne({
      where: {
        appointmentDate: today,
        status: 'in_service'
      }
    });

    if (currentQueue) {
      return c.json({
        success: false,
        message: 'Masih ada pasien yang sedang dilayani'
      }, 400);
    }

    // Get next waiting queue
    const nextQueue = await Queue.findOne({
      where: {
        appointmentDate: today,
        status: 'waiting'
      },
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }],
      order: [['queueNumber', 'ASC']]
    });

    if (!nextQueue) {
      return c.json({
        success: false,
        message: 'Tidak ada antrian yang menunggu'
      }, 404);
    }

    // Update queue status to in_service
    await nextQueue.update({
      status: 'in_service',
      serviceStartedAt: new Date()
    });

    // Log activity
    await logActivity({
      type: 'queue_called',
      title: 'Antrian dipanggil',
      description: `${(nextQueue as any).patient.fullName} (Nomor ${nextQueue.queueNumber}) dipanggil untuk dilayani`,
      userId: nextQueue.userId,
      queueId: nextQueue.id,
      metadata: {
        queueNumber: nextQueue.queueNumber,
        patientName: (nextQueue as any).patient.fullName,
        calledAt: new Date()
      }
    });

    // Emit socket event for real-time updates
    if (io) {
      io.emit('queue_called', {
        queue: nextQueue,
        message: `Panggilan untuk ${(nextQueue as any).patient.fullName} - Nomor Antrian ${nextQueue.queueNumber}`
      });
    }

    return c.json({
      success: true,
      message: 'Antrian berhasil dipanggil',
      data: { queue: nextQueue }
    });
  } catch (error) {
    console.error('Call next queue error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const completeQueue = async (c: Context) => {
  try {
    const queueId = c.req.param('queueId');
    
    const queue = await Queue.findOne({
      where: { id: queueId, status: 'in_service' },
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }]
    });

    if (!queue) {
      return c.json({
        success: false,
        message: 'Antrian tidak ditemukan atau tidak sedang dilayani'
      }, 404);
    }

    const serviceStartedAt = new Date(queue.serviceStartedAt!);
    const serviceCompletedAt = new Date();
    const actualServiceTime = Math.round((serviceCompletedAt.getTime() - serviceStartedAt.getTime()) / (1000 * 60)); // in minutes

    await queue.update({
      status: 'completed',
      serviceCompletedAt,
      actualServiceTime
    });

    // Log activity
    await logActivity({
      type: 'queue_completed',
      title: 'Antrian selesai',
      description: `${(queue as any).patient.fullName} (Nomor ${queue.queueNumber}) telah selesai dilayani`,
      userId: queue.userId,
      queueId: queue.id,
      metadata: {
        queueNumber: queue.queueNumber,
        patientName: (queue as any).patient.fullName,
        serviceTime: actualServiceTime,
        completedAt: serviceCompletedAt
      }
    });

    // Emit socket event for real-time updates
    if (io) {
      io.emit('queue_completed', {
        queue: queue,
        message: `${(queue as any).patient.fullName} telah selesai dilayani`
      });
    }

    return c.json({
      success: true,
      message: 'Antrian berhasil diselesaikan',
      data: { queue }
    });
  } catch (error) {
    console.error('Complete queue error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const updateQueueStatus = async (c: Context) => {
  try {
    const queueId = c.req.param('queueId');
    const { status, notes } = await c.req.json();

    const validStatuses = ['waiting', 'in_service', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return c.json({
        success: false,
        message: 'Status tidak valid'
      }, 400);
    }

    const queue = await Queue.findByPk(queueId, {
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }]
    });

    if (!queue) {
      return c.json({
        success: false,
        message: 'Antrian tidak ditemukan'
      }, 404);
    }

    const updateData: any = { status };
    if (notes) updateData.notes = notes;

    if (status === 'completed' && queue.status === 'in_service') {
      updateData.serviceCompletedAt = new Date();
      if (queue.serviceStartedAt) {
        const actualServiceTime = Math.round((new Date().getTime() - new Date(queue.serviceStartedAt).getTime()) / (1000 * 60));
        updateData.actualServiceTime = actualServiceTime;
      }
    }

    await queue.update(updateData);

    // Log activity based on status
    const activityTypes: Record<string, 'queue_completed' | 'queue_cancelled' | 'queue_no_show'> = {
      'completed': 'queue_completed',
      'cancelled': 'queue_cancelled',
      'no_show': 'queue_no_show'
    };

    const activityTitles: Record<string, string> = {
      'completed': 'Antrian selesai',
      'cancelled': 'Antrian dibatalkan',
      'no_show': 'Pasien tidak hadir'
    };

    if (activityTypes[status]) {
      await logActivity({
        type: activityTypes[status],
        title: activityTitles[status],
        description: `${(queue as any).patient.fullName} (Nomor ${queue.queueNumber}) - ${activityTitles[status].toLowerCase()}${notes ? `. Catatan: ${notes}` : ''}`,
        userId: queue.userId,
        queueId: queue.id,
        metadata: {
          queueNumber: queue.queueNumber,
          patientName: (queue as any).patient.fullName,
          previousStatus: queue.status,
          newStatus: status,
          notes: notes || null,
          updatedAt: new Date()
        }
      });
    }

    // Emit socket event for real-time updates
    if (io) {
      io.emit('queue_updated', {
        queue: queue,
        message: `Status antrian ${(queue as any).patient.fullName} diubah menjadi ${status}`
      });
    }

    return c.json({
      success: true,
      message: 'Status antrian berhasil diperbarui',
      data: { queue }
    });
  } catch (error) {
    console.error('Update queue status error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getQueuesByDate = async (c: Context) => {
  try {
    const { date } = c.req.query();
    
    if (!date) {
      return c.json({
        success: false,
        message: 'Parameter tanggal diperlukan'
      }, 400);
    }

    const queues = await Queue.findAll({
      where: { appointmentDate: date },
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }],
      order: [['queueNumber', 'ASC']]
    });

    const stats = {
      total: queues.length,
      waiting: queues.filter(q => q.status === 'waiting').length,
      in_service: queues.filter(q => q.status === 'in_service').length,
      completed: queues.filter(q => q.status === 'completed').length,
      cancelled: queues.filter(q => q.status === 'cancelled').length,
      no_show: queues.filter(q => q.status === 'no_show').length
    };

    return c.json({
      success: true,
      data: { queues, stats }
    });
  } catch (error) {
    console.error('Get queues by date error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const bookQueueForPatient = async (c: Context) => {
  try {
    const { appointmentDate, patientId, notes } = await c.req.json();
    const adminUser = c.get('user');

    if (!appointmentDate || !patientId) {
      return c.json({
        success: false,
        message: 'Parameter appointmentDate dan patientId diperlukan'
      }, 400);
    }

    // Check if patient exists
    const patient = await User.findByPk(patientId);
    if (!patient) {
      return c.json({
        success: false,
        message: 'Pasien tidak ditemukan'
      }, 404);
    }

    // Check if patient already has a queue for this date
    const existingQueue = await Queue.findOne({
      where: {
        userId: patientId,
        appointmentDate,
        status: { [Op.not]: 'cancelled' } as any
      }
    });

    if (existingQueue) {
      return c.json({
        success: false,
        message: 'Pasien sudah memiliki antrian pada tanggal tersebut'
      }, 400);
    }

    const settings = await PracticeSettings.findOne({ where: { isActive: true } });
    if (!settings) {
      return c.json({
        success: false,
        message: 'Pengaturan praktik belum dikonfigurasi'
      }, 500);
    }

    const queueCount = await Queue.count({
      where: {
        appointmentDate,
        status: { [Op.not]: 'cancelled' } as any
      }
    });

    if (queueCount >= settings.maxSlotsPerDay) {
      return c.json({
        success: false,
        message: 'Slot antrian untuk tanggal tersebut sudah penuh'
      }, 400);
    }

    const queueNumber = queueCount + 1;

    const queue = await Queue.create({
      userId: patientId,
      appointmentDate,
      queueNumber,
      notes: notes || `Antrian dibuat manual oleh admin untuk ${patient.fullName}`,
      status: 'waiting'
    });

    const queueWithUser = await Queue.findByPk(queue.id, {
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }]
    });

    if (!queueWithUser) throw new Error('Queue not found after creation');

    // Log activity
    await logActivity({
      type: 'queue_created',
      title: 'Antrian manual dibuat oleh admin',
      description: `Admin membuat antrian nomor ${queueWithUser.queueNumber} untuk ${(queueWithUser as any).patient.fullName}`,
      userId: queueWithUser.userId,
      queueId: queueWithUser.id,
      metadata: {
        queueNumber: queueWithUser.queueNumber,
        appointmentDate: queueWithUser.appointmentDate,
        patientName: (queueWithUser as any).patient.fullName,
        createdByAdmin: true,
        adminUserId: adminUser.id
      }
    });

    return c.json({
      success: true,
      message: 'Antrian berhasil dibuat',
      data: { 
        queue: queueWithUser,
        queueNumber: queueWithUser.queueNumber
      }
    }, 201);
  } catch (error) {
    console.error('Book queue for patient error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getReportsByDateRange = async (c: Context) => {
  try {
    const { startDate, endDate } = c.req.query();
    
    if (!startDate || !endDate) {
      return c.json({
        success: false,
        message: 'Parameter startDate dan endDate diperlukan'
      }, 400);
    }

    // Validate date range (max 31 days)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 31) {
      return c.json({
        success: false,
        message: 'Periode maksimal 31 hari'
      }, 400);
    }

    if (start > end) {
      return c.json({
        success: false,
        message: 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir'
      }, 400);
    }

    // Get all queues in date range
    const queues = await Queue.findAll({
      where: {
        appointmentDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [{ model: User, as: 'patient', attributes: ['fullName', 'phoneNumber'] }],
      order: [['appointmentDate', 'ASC'], ['queueNumber', 'ASC']]
    });

    // Group by date and calculate stats
    const dailyStats: any = {};
    const totalStats: any = {
      total: 0,
      waiting: 0,
      in_service: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0
    };

    queues.forEach(queue => {
      const date = queue.appointmentDate;
      const status = queue.status;
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          total: 0,
          waiting: 0,
          in_service: 0,
          completed: 0,
          cancelled: 0,
          no_show: 0,
          queues: []
        };
      }
      
      // Count by status
      dailyStats[date].total++;
      if (dailyStats[date][status] !== undefined) {
        dailyStats[date][status]++;
      }
      dailyStats[date].queues.push(queue);
      
      // Add to total stats
      totalStats.total++;
      if (totalStats[status] !== undefined) {
        totalStats[status]++;
      }
    });

    return c.json({
      success: true,
      data: {
        dailyStats,
        totalStats,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};
