import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';

interface ValidationError {
  field: string;
  message: string;
}

const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

export const validateRegistration = createMiddleware(async (c: Context, next: Next) => {
  try {
    const body = await c.req.json();
    const errors: ValidationError[] = [];

    // Validate fullName
    if (!body.fullName || typeof body.fullName !== 'string') {
      errors.push({ field: 'fullName', message: 'Nama lengkap diperlukan' });
    } else if (body.fullName.trim().length < 2 || body.fullName.trim().length > 100) {
      errors.push({ field: 'fullName', message: 'Nama lengkap harus antara 2-100 karakter' });
    }

    // Validate phoneNumber
    if (!body.phoneNumber || typeof body.phoneNumber !== 'string') {
      errors.push({ field: 'phoneNumber', message: 'Nomor telepon diperlukan' });
    } else if (!phoneRegex.test(body.phoneNumber)) {
      errors.push({ field: 'phoneNumber', message: 'Nomor telepon tidak valid' });
    }

    // Validate password
    if (!body.password || typeof body.password !== 'string') {
      errors.push({ field: 'password', message: 'Password diperlukan' });
    } else if (body.password.length < 8) {
      errors.push({ field: 'password', message: 'Password minimal 8 karakter' });
    } else if (!passwordRegex.test(body.password)) {
      errors.push({ 
        field: 'password', 
        message: 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol' 
      });
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors
      }, 400);
    }

    await next();
  } catch (error) {
    return c.json({
      success: false,
      message: 'Invalid request body'
    }, 400);
  }
});

export const validateLogin = createMiddleware(async (c: Context, next: Next) => {
  try {
    const body = await c.req.json();
    const errors: ValidationError[] = [];

    if (!body.phoneNumber) {
      errors.push({ field: 'phoneNumber', message: 'Nomor telepon diperlukan' });
    }

    if (!body.password) {
      errors.push({ field: 'password', message: 'Password diperlukan' });
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors
      }, 400);
    }

    await next();
  } catch (error) {
    return c.json({
      success: false,
      message: 'Invalid request body'
    }, 400);
  }
});

export const validateQueueBooking = createMiddleware(async (c: Context, next: Next) => {
  try {
    const body = await c.req.json();
    const errors: ValidationError[] = [];

    if (!body.appointmentDate) {
      errors.push({ field: 'appointmentDate', message: 'Tanggal appointment diperlukan' });
    } else {
      const date = new Date(body.appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(date.getTime())) {
        errors.push({ field: 'appointmentDate', message: 'Format tanggal tidak valid' });
      } else if (date < today) {
        errors.push({ field: 'appointmentDate', message: 'Tanggal appointment tidak boleh di masa lalu' });
      }
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors
      }, 400);
    }

    await next();
  } catch (error) {
    return c.json({
      success: false,
      message: 'Invalid request body'
    }, 400);
  }
});
