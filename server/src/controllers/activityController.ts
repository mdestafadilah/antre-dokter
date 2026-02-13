import { Context } from 'hono';
import { ActivityLog, User, Queue } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

export const getRecentActivities = async (c: Context) => {
  try {
    const { limit = '20', type, date } = c.req.query();
    
    const whereClause: any = {};
    
    // Filter by type if provided
    if (type && type !== 'all') {
      whereClause.type = type;
    }
    
    // Filter by date if provided
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      whereClause.createdAt = {
        [Op.gte]: startDate,
        [Op.lt]: endDate
      };
    }

    const activities = await ActivityLog.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['fullName', 'phoneNumber'],
          required: false
        },
        {
          model: Queue,
          as: 'queue',
          attributes: ['queueNumber', 'appointmentDate'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    return c.json({
      success: true,
      data: { activities }
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const getActivityStats = async (c: Context) => {
  try {
    const { date } = c.req.query();
    const today = date || new Date().toISOString().split('T')[0];
    
    const startDate = new Date(today);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1);

    const stats = await ActivityLog.findAll({
      where: {
        createdAt: {
          [Op.gte]: startDate,
          [Op.lt]: endDate
        }
      },
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['type'],
      raw: true
    });

    const formattedStats = (stats as any[]).reduce((acc, stat) => {
      acc[stat.type] = parseInt(stat.count);
      return acc;
    }, {} as Record<string, number>);

    return c.json({
      success: true,
      data: { stats: formattedStats }
    });
  } catch (error) {
    console.error('Get activity stats error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};
