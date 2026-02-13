import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

interface JWTPayload {
  id: string;
}

export const authenticate = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return c.json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      }, 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const user = await User.findByPk(decoded.id);

    if (!user || !(user as any).isActive) {
      return c.json({ 
        success: false, 
        message: 'Invalid token or user not active.' 
      }, 401);
    }

    // Store user in context
    c.set('user', user);
    await next();
  } catch (error) {
    return c.json({ 
      success: false, 
      message: 'Invalid token.' 
    }, 401);
  }
};

export const authorize = (...roles: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ 
        success: false, 
        message: 'Access denied. Please authenticate first.' 
      }, 401);
    }

    if (!roles.includes((user as any).role)) {
      return c.json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      }, 403);
    }

    await next();
  };
};
