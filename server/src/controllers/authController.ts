import { Context } from 'hono';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/index.js';

const generateToken = (userId: string): string => {
  const options: SignOptions = {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  };
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'default-secret', options);
};

export const register = async (c: Context) => {
  try {
    const { fullName, phoneNumber, password } = await c.req.json();

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
    });

    const token = generateToken(user.id);

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
};

export const login = async (c: Context) => {
  try {
    const { phoneNumber, password } = await c.req.json();

    const user = await User.findOne({ where: { phoneNumber } });
    if (!user) {
      return c.json({
        success: false,
        message: 'Nomor telepon atau password salah'
      }, 401);
    }

    if (!user.isActive) {
      return c.json({
        success: false,
        message: 'Akun Anda tidak aktif. Silakan hubungi admin'
      }, 401);
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return c.json({
        success: false,
        message: 'Nomor telepon atau password salah'
      }, 401);
    }

    await user.update({ lastLogin: new Date() });

    const token = generateToken(user.id);

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
};

export const me = async (c: Context) => {
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
};
