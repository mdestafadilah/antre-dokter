import { Context } from 'hono';
import { User, Queue, ActivityLog } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

export const getAllPatients = async (c: Context) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      search = '', 
      sortBy = 'createdAt', 
      sortOrder = 'DESC' 
    } = c.req.query();

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause: any = {
      role: 'patient'
    };

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: patients } = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'fullName', 'phoneNumber', 'isActive', 'lastLogin', 'createdAt', 'updatedAt'],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Queue,
          as: 'queues',
          attributes: ['id', 'status'],
          required: false
        }
      ]
    });

    // Add statistics for each patient
    const patientsWithStats = await Promise.all(
      patients.map(async (patient) => {
        const stats = await Queue.findAll({
          where: { userId: patient.id },
          attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['status'],
          raw: true
        });

        const queueStats: Record<string, number> = {
          total: 0,
          waiting: 0,
          completed: 0,
          cancelled: 0,
          in_service: 0,
          no_show: 0
        };

        (stats as any[]).forEach(stat => {
          queueStats[stat.status] = parseInt(stat.count);
          queueStats.total += parseInt(stat.count);
        });

        // Get last queue
        const lastQueue = await Queue.findOne({
          where: { userId: patient.id },
          order: [['createdAt', 'DESC']],
          attributes: ['appointmentDate', 'status', 'createdAt']
        });

        return {
          ...patient.toJSON(),
          queueStats,
          lastQueue
        };
      })
    );

    const totalPages = Math.ceil(count / parseInt(limit));

    return c.json({
      success: true,
      data: {
        patients: patientsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all patients error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getPatientDetail = async (c: Context) => {
  try {
    const patientId = c.req.param('patientId');

    const patient = await User.findOne({
      where: { 
        id: patientId,
        role: 'patient'
      },
      attributes: ['id', 'fullName', 'phoneNumber', 'isActive', 'lastLogin', 'createdAt', 'updatedAt']
    });

    if (!patient) {
      return c.json({
        success: false,
        message: 'Pasien tidak ditemukan'
      }, 404);
    }

    // Get patient's queue history
    const queues = await Queue.findAll({
      where: { userId: patientId },
      order: [['createdAt', 'DESC']],
      limit: 50 // Last 50 queues
    });

    // Get patient's activity logs
    const activities = await ActivityLog.findAll({
      where: { userId: patientId },
      order: [['createdAt', 'DESC']],
      limit: 20 // Last 20 activities
    });

    // Calculate statistics
    const stats = await Queue.findAll({
      where: { userId: patientId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const queueStats: Record<string, number> = {
      total: 0,
      waiting: 0,
      completed: 0,
      cancelled: 0,
      in_service: 0,
      no_show: 0
    };

    (stats as any[]).forEach(stat => {
      queueStats[stat.status] = parseInt(stat.count);
      queueStats.total += parseInt(stat.count);
    });

    // Calculate visit frequency (per month for last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const visitFrequency = await Queue.findAll({
      where: {
        userId: patientId,
        appointmentDate: {
          [Op.gte]: sixMonthsAgo.toISOString().split('T')[0]
        } as any,
        status: 'completed'
      },
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('appointmentDate')), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'visits']
      ],
      group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('appointmentDate'))],
      order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('appointmentDate')), 'ASC']],
      raw: true
    });

    return c.json({
      success: true,
      data: {
        patient: patient.toJSON(),
        queues,
        activities,
        stats: queueStats,
        visitFrequency
      }
    });
  } catch (error) {
    console.error('Get patient detail error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const updatePatientStatus = async (c: Context) => {
  try {
    const patientId = c.req.param('patientId');
    const { isActive } = await c.req.json();

    const patient = await User.findOne({
      where: { 
        id: patientId,
        role: 'patient'
      }
    });

    if (!patient) {
      return c.json({
        success: false,
        message: 'Pasien tidak ditemukan'
      }, 404);
    }

    await patient.update({ isActive });

    return c.json({
      success: true,
      message: `Status pasien berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: { patient: patient.toJSON() }
    });
  } catch (error) {
    console.error('Update patient status error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getPatientStats = async (c: Context) => {
  try {
    // Total patients
    const totalPatients = await User.count({
      where: { role: 'patient' }
    });

    // Active patients
    const activePatients = await User.count({
      where: { 
        role: 'patient',
        isActive: true
      }
    });

    // New patients this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const newThisMonth = await User.count({
      where: {
        role: 'patient',
        createdAt: {
          [Op.gte]: thisMonth
        }
      }
    });

    // Patients with active queues
    const patientsWithActiveQueues = await User.count({
      where: {
        role: 'patient'
      },
      include: [
        {
          model: Queue,
          as: 'queues',
          where: {
            status: ['waiting', 'in_service']
          },
          required: true
        }
      ]
    });

    return c.json({
      success: true,
      data: {
        totalPatients,
        activePatients,
        inactivePatients: totalPatients - activePatients,
        newThisMonth,
        patientsWithActiveQueues
      }
    });
  } catch (error) {
    console.error('Get patient stats error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};
