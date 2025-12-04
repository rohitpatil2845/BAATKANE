import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from '../config/database';

// Extend Express Request to include auth properties
export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
  body: any;
  params: any;
  query: any;
  headers: any;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    // Fetch user from database
    const [users] = await db.query(
      'SELECT id, name, username, email, avatar, status, last_seen FROM users WHERE id = ?',
      [decoded.userId]
    );

    const user = (users as any[])[0];

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.userId = user.id;
    req.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      lastSeen: user.last_seen
    };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
