import { Hono } from 'hono';
import { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';

const router = new Hono();

const generateToken = (userId: number): string => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

// Register
router.post('/register', async (c: Context) => {
  try {
    const body = await c.req.json();
    const { fullName, phoneNumber, password } = body;

    // Basic validation
    if (!fullName || !phoneNumber || !password) {
      return c.json({
        success: false,
        message: 'Semua field harus diisi'
      }, 400);
    }

    const existingUser = await User.findOne({ where: { phoneNumber } });
    if (existingUser) {
      return c.json({
        success: false,
        message: 'Nomor telepon sudah terdaftar'
      }, 400);
    }

    const user = await User.create({
      fullName,
      phoneNumber,
      password,
      role: 'patient'
    } as any);

    const token = generateToken((user as any).id);

    return c.json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user,
        token
      }
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
});

// Login
router.post('/login', async (c: Context) => {
  try {
    const body = await c.req.json();
    const { phoneNumber, password } = body;

    if (!phoneNumber || !password) {
      return c.json({
        success: false,
        message: 'Nomor telepon dan password harus diisi'
      }, 400);
    }

    const user = await User.findOne({ where: { phoneNumber } });
    if (!user) {
      return c.json({
        success: false,
        message: 'Nomor telepon atau password salah'
      }, 401);
    }

    if (!(user as any).isActive) {
      return c.json({
        success: false,
        message: 'Akun Anda tidak aktif. Silakan hubungi admin'
      }, 401);
    }

    const isPasswordValid = await (user as any).validatePassword(password);
    if (!isPasswordValid) {
      return c.json({
        success: false,
        message: 'Nomor telepon atau password salah'
      }, 401);
    }

    await user.update({ lastLogin: new Date() } as any);

    const token = generateToken((user as any).id);

    return c.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
});

// Get current user profile
router.get('/me', authenticate, async (c: Context) => {
  try {
    const user = c.get('user');
    return c.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({
      success: false,
      message: 'Terjadi kesalahan pada server'
    }, 500);
  }
});

export default router;
