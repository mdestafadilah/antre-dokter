import { Context } from 'hono';
import { PracticeSettings } from '../models/index.js';

export const getSettings = async (c: Context) => {
  try {
    const settings = await PracticeSettings.findOne({ where: { isActive: true } });
    
    if (!settings) {
      return c.json({
        success: false,
        message: 'Pengaturan tidak ditemukan'
      }, 404);
    }

    return c.json({
      success: true,
      data: { settings }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};

export const updateSettings = async (c: Context) => {
  try {
    const body = await c.req.json();
    const {
      doctorName,
      practiceName,
      practiceAddress,
      practicePhone,
      operatingDays,
      operatingHours,
      maxSlotsPerDay,
      allowWalkIn,
      cancellationDeadline
    } = body;

    let settings = await PracticeSettings.findOne({ where: { isActive: true } });
    
    if (!settings) {
      // Create new settings if none exist
      settings = await PracticeSettings.create({
        doctorName,
        practiceName,
        practiceAddress,
        practicePhone,
        operatingDays,
        operatingHours,
        maxSlotsPerDay,
        allowWalkIn,
        cancellationDeadline,
        isActive: true
      });
    } else {
      // Update existing settings
      await settings.update({
        doctorName,
        practiceName,
        practiceAddress,
        practicePhone,
        operatingDays,
        operatingHours,
        maxSlotsPerDay,
        allowWalkIn,
        cancellationDeadline
      });
    }

    return c.json({
      success: true,
      message: 'Pengaturan berhasil diperbarui',
      data: { settings }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
};
